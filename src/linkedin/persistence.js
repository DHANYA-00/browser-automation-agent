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
