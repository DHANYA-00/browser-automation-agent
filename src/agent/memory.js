class Memory {
  constructor() {
    this.task = null;
    this.history = [];
    this.activeSearchKeyword = null;
    this.extractedJobs = [];
    this.processedJobs = [];
    this.failedJobs = [];
    this.currentJobIndex = 0;
  }

  setTask(task) {
    this.task = task;
  }

  addHistory(action) {
    this.history.push({
      action,
      timestamp: new Date().toISOString(),
    });
  }

  getHistory() {
    return this.history;
  }

  getRecentHistory(n = 5) {
    return this.history.slice(-n).map((item) => item.action);
  }

  normalizeJobUrl(jobUrl) {
    if (!jobUrl) return "";
    return String(jobUrl).trim().replace(/\?.*$/, "");
  }

  recordSuccess(job) {
    const normalizedJob = job && typeof job === "object" ? { ...job } : { jobUrl: job };
    const jobUrl = this.normalizeJobUrl(normalizedJob.jobUrl || normalizedJob.url || "");

    if (jobUrl && !this.processedJobs.some((entry) => this.normalizeJobUrl((entry && (entry.jobUrl || entry.url)) || "") === jobUrl)) {
      this.processedJobs.push({ ...normalizedJob, jobUrl });
    } else if (!jobUrl) {
      this.processedJobs.push(normalizedJob);
    }

    return this.processedJobs;
  }

  recordFailure(job, error) {
    const normalizedJob = job && typeof job === "object" ? { ...job } : { jobUrl: job };
    const errorMessage = error && error.message ? error.message : String(error || "Unknown error");
    const jobUrl = this.normalizeJobUrl(normalizedJob.jobUrl || normalizedJob.url || "");

    this.failedJobs.push({
      ...normalizedJob,
      jobUrl,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    return this.failedJobs;
  }

  isProcessed(jobUrl) {
    const normalizedTarget = this.normalizeJobUrl(jobUrl);
    return this.processedJobs.some((entry) => {
      const currentUrl = this.normalizeJobUrl((entry && (entry.jobUrl || entry.url)) || "");
      return currentUrl && currentUrl === normalizedTarget;
    });
  }

  getState() {
    return {
      task: this.task,
      activeSearchKeyword: this.activeSearchKeyword,
      extractedJobs: this.extractedJobs,
      processedJobs: this.processedJobs,
      failedJobs: this.failedJobs,
      currentJobIndex: this.currentJobIndex,
      totalActionsExecuted: this.history.length,
      history: this.history,
    };
  }
}

module.exports = Memory;