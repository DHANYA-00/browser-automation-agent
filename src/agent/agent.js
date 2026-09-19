const fs = require("fs");
const path = require("path");
const Observer = require("./observer");
const Memory = require("./memory");
const Planner = require("./planner");
const { executeAction } = require("../browser/actions");

const MAX_JOBS_PER_SEARCH = 10;

class Agent {
  constructor(browser, options = {}) {
    this.browser = browser;
    this.maxSteps = options.maxSteps || 15;
    this.maxConsecutiveFailures = options.maxConsecutiveFailures || 3;

    this.observer = new Observer(browser);
    this.memory = new Memory();
    this.planner = new Planner(options.plannerOptions || {});
    this.actionEngine = {
      execute: executeAction,
    };
  }

  async captureErrorScreenshot(step) {
    const screenshotsDir = path.join(process.cwd(), "screenshots");
    fs.mkdirSync(screenshotsDir, { recursive: true });

    const screenshotPath = path.join(screenshotsDir, `agent-error-step-${step}.png`);
    if (!this.browser || typeof this.browser.screenshot !== "function") {
      return screenshotPath;
    }

    try {
      await this.browser.screenshot(screenshotPath);
    } catch (error) {
      console.warn(`Unable to capture screenshot for step ${step}: ${error.message}`);
    }

    return screenshotPath;
  }

  verifyActionSuccess(beforeObservation, afterObservation, action) {
    const beforeUrl = beforeObservation?.url || "";
    const afterUrl = afterObservation?.url || "";
    const beforeTitle = beforeObservation?.title || "";
    const afterTitle = afterObservation?.title || "";

    const beforeVisibleText = beforeObservation?.visibleText || "";
    const afterVisibleText = afterObservation?.visibleText || "";
    const beforeJobCount = Array.isArray(beforeObservation?.jobs) ? beforeObservation.jobs.length : 0;
    const afterJobCount = Array.isArray(afterObservation?.jobs) ? afterObservation.jobs.length : 0;

    const urlChanged = beforeUrl && afterUrl && beforeUrl !== afterUrl;
    const titleChanged = !!afterTitle && afterTitle !== beforeTitle;
    const jobsChanged = afterJobCount !== beforeJobCount;
    const textChanged = afterVisibleText && afterVisibleText !== beforeVisibleText;

    const success =
      action.type === "DONE" ||
      urlChanged ||
      titleChanged ||
      jobsChanged ||
      textChanged ||
      !!afterObservation?.currentPageState?.resultCount;

    const reason = success
      ? "Post-action observation indicates the page changed or the target state is present."
      : "Post-action observation did not show a meaningful state change.";

    return { success, reason };
  }

  async processBatchJobs(observation, task = "") {
    const jobs = Array.isArray(observation?.jobs) ? observation.jobs.slice(0, MAX_JOBS_PER_SEARCH) : [];
    if (!jobs.length) {
      return { processed: 0, failed: 0, total: 0 };
    }

    const activeKeyword =
      this.memory.activeSearchKeyword ||
      task.match(/(?:search for|find|looking for)\s+(.+?)(?: jobs| job)/i)?.[1] ||
      "jobs";

    this.memory.activeSearchKeyword = activeKeyword;
    this.memory.extractedJobs = jobs;

    let processedCount = 0;
    let failedCount = 0;

    for (let index = 0; index < jobs.length; index++) {
      const job = jobs[index];
      const jobUrl = this.memory.normalizeJobUrl(job?.jobUrl || job?.url || "");
      this.memory.currentJobIndex = index;

      if (!jobUrl || this.memory.isProcessed(jobUrl)) {
        continue;
      }

      try {
        if (jobUrl) {
          await this.browser.goto(jobUrl);
        }

        const detailObservation = await this.observer.observe(this.browser);
        const detailedJob = {
          ...job,
          jobUrl,
          jobTitle: job.jobTitle || detailObservation.title || "",
          companyName: job.companyName || "",
          location: job.location || "",
          description: detailObservation.visibleText || "",
          metadata: detailObservation.currentPageState || {},
          observedAt: new Date().toISOString(),
        };

        this.memory.recordSuccess(detailedJob);
        processedCount += 1;
        console.log(`✅ Processed job ${index + 1}/${jobs.length}: ${detailedJob.jobTitle || jobUrl}`);
      } catch (error) {
        failedCount += 1;
        const screenshotPath = path.join(process.cwd(), "screenshots", `error-job-${index}.png`);
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
        await this.browser.screenshot(screenshotPath).catch(() => {});
        this.memory.recordFailure(job, error);
        console.warn(
          `⚠️ Failed to process job ${index + 1}/${jobs.length}: ${error.message}. Screenshot saved to ${screenshotPath}`
        );
      }

      if (index < jobs.length - 1) {
        await this.browser.wait(1500);
      }
    }

    return {
      processed: processedCount,
      failed: failedCount,
      total: jobs.length,
    };
  }

  async run(task) {
    console.log("\n🤖 AI Browser Operator");
    console.log(`🎯 Task: ${task}\n`);

    this.memory.setTask(task);

    let stepCount = 0;
    let consecutiveFailures = 0;
    let totalFailures = 0;
    let finalStatus = "in-progress";
    let statusReason = "";

    while (stepCount < this.maxSteps) {
      stepCount += 1;
      console.log(`\n--- Step ${stepCount}/${this.maxSteps} ---`);

      const observation = await this.observer.observe(this.browser);

      if (
        observation?.currentPageState?.isJobSearchResults &&
        Array.isArray(observation.jobs) &&
        observation.jobs.length > 0
      ) {
        const batchResult = await this.processBatchJobs(observation, task);
        this.memory.addHistory({
          type: "BATCH_PROCESSING",
          status: "success",
          processed: batchResult.processed,
          failed: batchResult.failed,
          total: batchResult.total,
          step: stepCount,
        });

        finalStatus = "DONE";
        statusReason = `Processed ${batchResult.processed} job(s) successfully; ${batchResult.failed} failed.`;
        console.log(`\n🎉 Batch processing finished. ${statusReason}`);
        break;
      }

      const history = this.memory.getRecentHistory(10);

      let action;
      try {
        const nextAction =
          typeof this.planner.planNextAction === "function"
            ? this.planner.planNextAction(task, observation, history)
            : this.planner.getNextAction(task, observation, history);

        action = await nextAction;

        if (typeof this.planner.validateAction === "function") {
          action = this.planner.validateAction(action);
        }

        console.log("🧠 Decided Action:", JSON.stringify(action));
      } catch (error) {
        const errorMessage = error && error.message ? error.message : String(error);
        console.error("❌ Planner Error:", errorMessage);
        finalStatus = "gave-up-after-failures";
        statusReason = `Planner error: ${errorMessage}`;
        this.memory.addHistory({
          type: "ERROR",
          status: "failed",
          failed: true,
          error: errorMessage,
          step: stepCount,
        });
        break;
      }

      if (action.type === "DONE") {
        statusReason = action.reason || "Goal achieved.";
        console.log(`\n🎉 Task Completed! Reason: ${statusReason}`);
        this.memory.addHistory({
          type: "DONE",
          status: "success",
          action,
          observation,
          step: stepCount,
        });
        finalStatus = "DONE";
        consecutiveFailures = 0;
        break;
      }

      let afterObservation = null;
      let verification = null;

      try {
        const actionResult = await this.actionEngine.execute(action);

        afterObservation = await this.observer.observe(this.browser);
        verification = this.verifyActionSuccess(observation, afterObservation, action);

        this.memory.addHistory({
          type: "ACTION",
          status: verification.success ? "success" : "warning",
          action,
          result: actionResult,
          observation,
          postActionObservation: afterObservation,
          verification,
          step: stepCount,
        });

        if (verification.success) {
          consecutiveFailures = 0;
          continue;
        }
      } catch (error) {
        consecutiveFailures += 1;
        totalFailures += 1;

        const screenshotPath = await this.captureErrorScreenshot(stepCount);
        console.warn(
          `⚠️ Action [${action.type}] failed (Consecutive Failure ${consecutiveFailures}/${this.maxConsecutiveFailures}): ${error.message}. Screenshot: ${screenshotPath}`
        );

        this.memory.recordFailure(
          {
            action,
            step: stepCount,
            screenshot: screenshotPath,
          },
          error
        );

        this.memory.addHistory({
          type: "ACTION",
          status: "failed",
          failed: true,
          action,
          error: error.message,
          screenshot: screenshotPath,
          observation,
          step: stepCount,
        });

        if (consecutiveFailures >= this.maxConsecutiveFailures) {
          statusReason = `Giving up after ${consecutiveFailures} consecutive action failures. Last error: ${error.message}`;
          console.error(`\n🛑 ${statusReason}`);
          finalStatus = "gave-up-after-failures";
          break;
        }
      }
    }

    if (finalStatus === "in-progress" && stepCount >= this.maxSteps) {
      statusReason = `Safety cap of ${this.maxSteps} steps reached without completing task.`;
      finalStatus = "step-limit-hit";
      console.log(`\n🛑 ${statusReason}`);
    }

    console.log(`\n✅ Agent finished execution with status: [${finalStatus}]`);

    const finalState = {
      task,
      stepsTaken: stepCount,
      retries: totalFailures,
      status: finalStatus,
      reason: statusReason,
      history: this.memory.getHistory(),
      state: this.memory.getState(),
    };

    return finalState;
  }
}

module.exports = Agent;