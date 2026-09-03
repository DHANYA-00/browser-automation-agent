const fs = require("fs");
const path = require("path");
const { applyFilters, printFilterSummary } = require("./filterJobs");

class JobStore {
  /**
   * @param {string} [filePath="data/jobs.json"] - Path to JSON persistence file
   */
  constructor(filePath = "data/jobs.json") {
    this.filePath = path.resolve(filePath);
    this._ensureFileExists();
  }

  _ensureFileExists() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), "utf-8");
    }
  }

  /**
   * Retrieves all stored job records.
   * @returns {Array<Object>}
   */
  getAllJobs() {
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      return JSON.parse(raw) || [];
    } catch (err) {
      console.warn(`⚠️ Failed to read jobs from ${this.filePath}: ${err.message}`);
      return [];
    }
  }

  /**
   * Retrieves a stored job record by job ID.
   * @param {string} jobId
   * @returns {Object|null}
   */
  /**
   * Retrieves all jobs matching a specific status.
   * Standard status values: "NEW", "queued", "filtered_out", "applied", "flagged_for_review", "failed".
   * @param {string} status 
   * @returns {Array<Object>}
   */
  getJobsByStatus(status) {
    const jobs = this.getAllJobs();
    return jobs.filter((j) => String(j.status).toLowerCase() === String(status).toLowerCase());
  }

  /**
   * Retrieves all queued jobs ready for application.
   * @returns {Array<Object>}
   */
  getQueuedJobs() {
    return this.getJobsByStatus("queued");
  }

  /**
   * Retrieves all jobs with status "flagged_for_review", sorted by most recent first.
   * @returns {Array<Object>}
   */
  getFlaggedJobs() {
    const flagged = this.getJobsByStatus("flagged_for_review");
    return flagged.sort((a, b) => {
      const timeA = new Date(a.flaggedAt || a.updatedAt || a.foundAt || 0).getTime();
      const timeB = new Date(b.flaggedAt || b.updatedAt || b.foundAt || 0).getTime();
      return timeB - timeA;
    });
  }

  getJobById(jobId) {
    const jobs = this.getAllJobs();
    return jobs.find((j) => String(j.id) === String(jobId)) || null;
  }

  /**
   * Inserts job records with deduplication by ID.
   * Leaves existing entries' status, reason, and foundAt untouched.
   *
   * @param {Array<Object>} jobList - Array of extracted job objects
   * @returns {Object} { newCount, existingCount, totalCount, newJobs }
   */
  saveJobs(jobList = []) {
    const existingJobs = this.getAllJobs();
    const existingMap = new Map(existingJobs.map((j) => [String(j.id), j]));

    let newCount = 0;
    let existingCount = 0;
    const newJobs = [];
    const nowIso = new Date().toISOString();

    for (const job of jobList) {
      if (!job || !job.id) continue;
      const strId = String(job.id).trim();

      if (existingMap.has(strId)) {
        existingCount++;
        // Keep existing record untouched (status, reason, foundAt remain preserved)
      } else {
        const record = {
          id: strId,
          title: job.title || "",
          company: job.company || "",
          location: job.location || "",
          postedDate: job.postedDate || "",
          easyApply: Boolean(job.easyApply),
          url: job.url || `https://www.linkedin.com/jobs/view/${strId}/`,
          foundAt: nowIso,
          status: job.status || "NEW", // Default status for newly discovered jobs
          reason: job.reason || null,
        };

        existingMap.set(strId, record);
        newJobs.push(record);
        newCount++;
      }
    }

    const updatedJobs = Array.from(existingMap.values());
    fs.writeFileSync(this.filePath, JSON.stringify(updatedJobs, null, 2), "utf-8");

    return {
      newCount,
      existingCount,
      totalCount: updatedJobs.length,
      newJobs,
    };
  }

  /**
   * Calculates total number of jobs applied today (YYYY-MM-DD).
   * @returns {number}
   */
  getAppliedCountToday() {
    const jobs = this.getAllJobs();
    const todayStr = new Date().toISOString().split("T")[0];

    return jobs.filter((j) => {
      if (String(j.status).toLowerCase() !== "applied") return false;
      const dateToCheck = j.appliedAt || j.updatedAt || j.foundAt;
      if (!dateToCheck) return false;
      return dateToCheck.startsWith(todayStr);
    }).length;
  }

  /**
   * Updates status and optional filter reason of an existing job.
   * @param {string} jobId
   * @param {string} status
   * @param {string|null} [reason=null]
   * @returns {boolean} True if job was found and updated
   */
  updateJobStatus(jobId, status, reason = null) {
    const jobs = this.getAllJobs();
    const target = jobs.find((j) => String(j.id) === String(jobId));
    if (target) {
      target.status = status;
      target.reason = reason;
      target.updatedAt = new Date().toISOString();
      if (!target.url) {
        target.url = `https://www.linkedin.com/jobs/view/${target.id}/`;
      }
      if (String(status).toLowerCase() === "applied" && !target.appliedAt) {
        target.appliedAt = new Date().toISOString();
      }
      if (String(status).toLowerCase() === "flagged_for_review") {
        target.flaggedAt = new Date().toISOString();
      }
      fs.writeFileSync(this.filePath, JSON.stringify(jobs, null, 2), "utf-8");
      return true;
    }
    return false;
  }

  /**
   * Applies deterministic filter rules to stored jobs and persists updated statuses.
   * Does NOT modify jobs with protected statuses ("applied", "flagged_for_review").
   *
   * @param {Object} config - Filter configuration options
   * @returns {Object} Filter summary results { queued, filteredOut, skipped }
   */
  applyFiltersAndSave(config = {}) {
    const allJobs = this.getAllJobs();
    const filterResults = applyFilters(allJobs, config);

    // Merge updated jobs back into map
    const jobMap = new Map(allJobs.map((j) => [String(j.id), j]));

    for (const job of [...filterResults.queued, ...filterResults.filteredOut]) {
      jobMap.set(String(job.id), job);
    }

    const updatedList = Array.from(jobMap.values());
    fs.writeFileSync(this.filePath, JSON.stringify(updatedList, null, 2), "utf-8");

    printFilterSummary(filterResults);
    return filterResults;
  }

  /**
   * Clears storage.
   */
  clear() {
    fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), "utf-8");
  }
}

module.exports = JobStore;
