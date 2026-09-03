const { loadConfig } = require("../../config");
const JobStore = require("./persistence");
const { applyToJob } = require("./easyApply");
const { checkForChallenge, SecurityChallengeError, getRandomDelay } = require("./safety");

/**
 * Production Queue Runner: Iterates through queued jobs with safety rails:
 * - Daily application cap enforcement (stops queue processing when reached)
 * - Human-like randomized delays between separate job applications
 * - CAPTCHA / Security Challenge hard stop (immediately aborts entire run)
 *
 * @param {Object} agent - AI Agent instance
 * @param {Object} [options]
 * @param {boolean} [options.dryRun=true] - DRY-RUN flag
 * @param {string} [options.storePath="data/jobs.json"] - Path to job store
 * @param {string} [options.configPath] - Custom config path
 * @returns {Promise<Object>} Summary outcome
 */
async function processJobQueue(agent, options = {}) {
  const {
    dryRun = true,
    storePath = "data/jobs.json",
    configPath,
  } = options;

  const config = loadConfig(configPath);
  const store = new JobStore(storePath);

  const dailyCap = config.dailyApplicationCap || 15;
  const appliedToday = store.getAppliedCountToday();

  console.log("\n=================================================");
  console.log("🚀 PRODUCTION LINKEDIN QUEUE RUNNER");
  console.log(`🔒 Mode: ${dryRun ? "DRY-RUN (Submissions Intercepted)" : "LIVE (Submissions Enabled)"}`);
  console.log(`📊 Daily Applications Today: ${appliedToday}/${dailyCap}`);
  console.log("=================================================\n");

  // 1. Initial Daily Cap Check
  if (appliedToday >= dailyCap) {
    console.warn(`🛑 DAILY APPLICATION CAP REACHED (${appliedToday}/${dailyCap})!`);
    console.warn("🔒 Stopping queue processing for the rest of today's run.");
    return {
      status: "cap_reached",
      appliedToday,
      dailyCap,
      processedCount: 0,
    };
  }

  const queuedJobs = store.getQueuedJobs();
  console.log(`📦 Found ${queuedJobs.length} queued jobs ready for application.`);

  if (queuedJobs.length === 0) {
    console.log("ℹ️ No queued jobs available in storage.");
    return { status: "no_jobs", processedCount: 0 };
  }

  let processedCount = 0;

  for (let i = 0; i < queuedJobs.length; i++) {
    const job = queuedJobs[i];

    // Re-check daily cap before each job execution
    const currentAppliedToday = store.getAppliedCountToday();
    if (currentAppliedToday >= dailyCap) {
      console.warn(`\n🛑 DAILY APPLICATION CAP REACHED (${currentAppliedToday}/${dailyCap})!`);
      console.warn("🔒 Stopping queue processing immediately.");
      break;
    }

    console.log(`\n📌 [Job ${i + 1}/${queuedJobs.length}] Processing: ${job.title} at ${job.company} (ID: ${job.id})`);

    try {
      // Execute Easy Apply handler with safety checks
      const result = await applyToJob(agent, job, {
        dryRun,
        config,
        store,
      });

      processedCount++;

      // If not the last job, pause with human-like randomized delay between job applications
      if (i < queuedJobs.length - 1 && currentAppliedToday + 1 < dailyCap) {
        const pauseMs = getRandomDelay(
          config.jobDelayMinMs || 30000,
          config.jobDelayMaxMs || 90000
        );
        console.log(`\n⏳ Human-like pacing delay: Waiting ${Math.round(pauseMs / 1000)}s before next job application...`);
        await agent.browser.wait(pauseMs);
      }
    } catch (err) {
      if (err instanceof SecurityChallengeError || err.name === "SecurityChallengeError") {
        console.error("\n=================================================");
        console.error("🚨 SECURITY CHALLENGE DETECTED — HARD STOPPING QUEUE RUNNER!");
        console.error(`📌 Reason: ${err.message}`);
        console.error("=================================================\n");
        return {
          status: "security_challenge_stop",
          error: err.message,
          processedCount,
        };
      } else {
        console.error(`❌ Unexpected error processing job ${job.id}: ${err.message}`);
        store.updateJobStatus(job.id, "failed", `Error: ${err.message}`);
      }
    }
  }

  const finalAppliedCount = store.getAppliedCountToday();
  console.log("\n=================================================");
  console.log("✅ QUEUE RUNNER PROCESSING COMPLETE");
  console.log(`📊 Total Processed This Run: ${processedCount}`);
  console.log(`📊 Daily Applications Today: ${finalAppliedCount}/${dailyCap}`);
  console.log("=================================================\n");

  return {
    status: "completed",
    processedCount,
    appliedToday: finalAppliedCount,
    dailyCap,
  };
}

module.exports = {
  processJobQueue,
};
