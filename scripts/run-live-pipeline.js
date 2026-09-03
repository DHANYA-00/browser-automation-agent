const Browser = require("../src/browser/browser");
const Agent = require("../src/agent/agent");
const {
  buildSearchUrl,
  extractJobCards,
  JobStore,
  loadConfig,
  processJobQueue,
  checkForChallenge,
} = require("../src/linkedin");

(async () => {
  console.log("=================================================");
  console.log("🚀 LIVE LINKEDIN APPLICATION PIPELINE RUN");
  console.log("⚠️ Mode: LIVE SUBMISSIONS ENABLED (dryRun: false)");
  console.log("=================================================\n");

  const startTime = Date.now();
  const config = loadConfig();
  const SESSION_PATH = "data/session.json";
  const STORE_PATH = "data/jobs.json";
  const store = new JobStore(STORE_PATH);

  console.log("📋 Configuration Loaded:");
  console.log(`   • Daily Application Cap: ${config.dailyApplicationCap} (Low-cap Live Test)`);
  console.log(`   • Action Delay Range:    ${config.actionDelayMinMs}ms - ${config.actionDelayMaxMs}ms`);
  console.log(`   • Job Delay Range:       ${config.jobDelayMinMs}ms - ${config.jobDelayMaxMs}ms`);
  console.log(`   • Resume Path:           "${config.resumePath}"\n`);

  const searchParams = {
    keywords: process.env.JOB_KEYWORDS || "Software Engineer",
    location: process.env.JOB_LOCATION || "United States",
    datePosted: "past_24h",
    easyApplyOnly: true,
  };

  const targetUrl = buildSearchUrl(searchParams);
  console.log(`🔗 Generated Search URL: ${targetUrl}\n`);

  const browser = new Browser();

  try {
    await browser.launch();

    // 1. Authenticate session
    console.log("--- Step 1: Session Authentication ---");
    const authenticated = await browser.loginLinkedIn(SESSION_PATH);
    if (!authenticated) {
      console.error("❌ Authentication failed. Please ensure data/session.json is valid.");
      process.exit(1);
    }

    // 2. Search & Navigate
    console.log("\n--- Step 2: Navigating to Target Search Page ---");
    await browser.goto(targetUrl);
    await browser.randomDelay(2000, 4000);
    await checkForChallenge(browser.page);

    // 3. Extract & Filter
    console.log("\n--- Step 3: Extracting & Filtering Job Cards ---");
    const rawCards = await extractJobCards(browser.page, { maxCards: 20 });
    const saveResult = store.saveJobs(rawCards);
    const filterResults = store.applyFiltersAndSave(config);

    // 4. Process Queued Jobs in LIVE Mode (dryRun: false)
    console.log("\n--- Step 4: Executing Live Queue Applications ---");
    const agent = new Agent(browser, {
      plannerOptions: {
        mockMode: !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY,
      },
    });

    const queueResult = await processJobQueue(agent, {
      dryRun: false, // LIVE SUBMISSIONS ACTIVE
      storePath: STORE_PATH,
      config,
    });

    // 5. Audit Metrics Summary
    const totalJobs = store.getAllJobs();
    const queuedJobs = store.getQueuedJobs();
    const appliedJobs = store.getJobsByStatus("applied");
    const flaggedJobs = store.getFlaggedJobs();
    const failedJobs = store.getJobsByStatus("failed");
    const appliedToday = store.getAppliedCountToday();
    const totalTimeMs = Date.now() - startTime;

    console.log("\n=================================================");
    console.log("📊 LIVE PIPELINE EXECUTION AUDIT SUMMARY");
    console.log("=================================================");
    console.log(` ⏱️ Total Duration:          ${Math.round(totalTimeMs / 1000)} seconds`);
    console.log(` 📦 Total Jobs in Store:     ${totalJobs.length}`);
    console.log(` 📥 Queued Jobs Remaining:   ${queuedJobs.length}`);
    console.log(` ✅ Live Submitted Jobs:    ${appliedJobs.length}`);
    console.log(` 🚩 Flagged for Review:      ${flaggedJobs.length}`);
    console.log(` ❌ Failed Jobs:             ${failedJobs.length}`);
    console.log(` 📊 Applied Today Count:     ${appliedToday} / ${config.dailyApplicationCap}`);
    console.log("=================================================\n");

    console.log("📄 Live Submitted Applications Log:");
    appliedJobs.forEach((job, idx) => {
      console.log(` [${idx + 1}] ID: ${job.id} | ${job.title} at ${job.company}`);
      console.log(`     Applied At:   ${job.appliedAt || job.updatedAt}`);
      console.log(`     URL:          ${job.url}`);
      console.log(`     Status Note:  ${job.reason || "Application submitted"}`);
      console.log("-------------------------------------------------");
    });
  } catch (err) {
    console.error("❌ Fatal Error during live execution:", err.message);
  } finally {
    await browser.close();
  }
})();
