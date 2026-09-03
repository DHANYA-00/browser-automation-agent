const Browser = require("../src/browser/browser");
const Agent = require("../src/agent/agent");
const {
  buildSearchUrl,
  extractJobCards,
  JobStore,
  loadConfig,
  printFilterSummary,
  processJobQueue,
  checkForChallenge,
} = require("../src/linkedin");

(async () => {
  console.log("=================================================");
  console.log("🚀 END-TO-END PIPELINE DRY-RUN VALIDATION RUN");
  console.log("🔒 Mode: DRY-RUN ONLY (dryRun: true enforced)");
  console.log("=================================================\n");

  const startTime = Date.now();
  const config = loadConfig();
  const SESSION_PATH = "data/session.json";
  const STORE_PATH = "data/jobs.json";
  const store = new JobStore(STORE_PATH);

  console.log("📋 Configuration Loaded:");
  console.log(`   • Daily Application Cap: ${config.dailyApplicationCap}`);
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

    // 2. Navigate & Search
    console.log("\n--- Step 2: Navigating to Search Target ---");
    await browser.goto(targetUrl);
    await browser.randomDelay(2000, 4000);
    await checkForChallenge(browser.page);

    // 3. Extract & Persist
    console.log("\n--- Step 3: Extracting Job Cards ---");
    const rawCards = await extractJobCards(browser.page, { maxCards: 20 });
    console.log(`📦 Extracted ${rawCards.length} job cards from page.`);

    const saveResult = store.saveJobs(rawCards);
    console.log(`💾 Saved to persistence: ${saveResult.newCount} new, ${saveResult.existingCount} existing.`);

    // 4. Deterministic Filtering
    console.log("\n--- Step 4: Applying Deterministic Filter Rules ---");
    const filterResults = store.applyFiltersAndSave(config);

    // 5. Execute Queue Runner in DRY-RUN mode
    console.log("\n--- Step 5: Executing Queue Runner in DRY-RUN Mode ---");
    const agent = new Agent(browser, {
      plannerOptions: {
        mockMode: !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY,
      },
    });

    const queueResult = await processJobQueue(agent, {
      dryRun: true, // CRITICAL: DRY-RUN ENFORCED
      storePath: STORE_PATH,
      config,
    });

    // 6. Generate Comprehensive Run Report
    const totalJobs = store.getAllJobs();
    const queuedJobs = store.getQueuedJobs();
    const appliedJobs = store.getJobsByStatus("applied");
    const flaggedJobs = store.getFlaggedJobs();
    const failedJobs = store.getJobsByStatus("failed");
    const filteredJobs = store.getJobsByStatus("filtered_out");
    const appliedToday = store.getAppliedCountToday();
    const totalTimeMs = Date.now() - startTime;

    console.log("\n=================================================");
    console.log("📊 END-TO-END PIPELINE DRY-RUN METRICS SUMMARY");
    console.log("=================================================");
    console.log(` ⏱️ Total Duration:          ${Math.round(totalTimeMs / 1000)} seconds`);
    console.log(` 📦 Total Jobs in Store:     ${totalJobs.length}`);
    console.log(` 🚫 Filtered Out Jobs:       ${filteredJobs.length}`);
    console.log(` 📥 Queued Jobs Remaining:   ${queuedJobs.length}`);
    console.log(` 🛡️ "Would Apply" (Dry Run): ${appliedJobs.length}`);
    console.log(` 🚩 Flagged for Review:      ${flaggedJobs.length}`);
    console.log(` ❌ Failed Jobs:             ${failedJobs.length}`);
    console.log(` 📊 Applied Today Count:     ${appliedToday} / ${config.dailyApplicationCap}`);
    console.log("=================================================\n");

    if (appliedToday <= config.dailyApplicationCap) {
      console.log(`✅ Daily Cap Safeguard: VERIFIED (${appliedToday} <= ${config.dailyApplicationCap})\n`);
    } else {
      console.error(`🚨 Daily Cap Safeguard: EXCEEDED (${appliedToday} > ${config.dailyApplicationCap})\n`);
    }
  } catch (err) {
    console.error("❌ Fatal Pipeline Error:", err.message);
  } finally {
    await browser.close();
  }
})();
