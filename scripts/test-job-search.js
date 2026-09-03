// MANUALLY EXECUTED DEV UTILITY SCRIPT (Not run in automated CI)
// Usage: node scripts/test-job-search.js

const Browser = require("../src/browser/browser");
const { buildSearchUrl, extractJobCards, JobStore, loadConfig } = require("../src/linkedin");

(async () => {
  console.log("=================================================");
  console.log("🔍 LINKEDIN JOB SEARCH & FILTER PIPELINE DEMO");
  console.log("=================================================\n");

  // 1. Load config (throws error if missing/invalid)
  const config = loadConfig();
  console.log("📋 Filter configuration loaded successfully.");

  const SESSION_PATH = "data/session.json";
  const STORAGE_FILE = "data/test_jobs.json";
  const store = new JobStore(STORAGE_FILE);

  // Search parameters
  const searchParams = {
    keywords: process.env.JOB_KEYWORDS || "Software Engineer",
    location: process.env.JOB_LOCATION || "United States",
    datePosted: "past_24h",
    easyApplyOnly: true,
  };

  const targetUrl = buildSearchUrl(searchParams);
  console.log(`📌 Search Parameters:`, searchParams);
  console.log(`🔗 Generated Search URL: ${targetUrl}\n`);

  const browser = new Browser();
  try {
    await browser.launch();

    // Step 1: Authenticate using saved session state
    console.log("--- Step 1: Authenticating Session ---");
    const authenticated = await browser.loginLinkedIn(SESSION_PATH);
    if (!authenticated) {
      console.error("❌ LinkedIn authentication failed. Please run login script first.");
      process.exit(1);
    }

    // Step 2: Navigate to search URL
    console.log("\n--- Step 2: Navigating to Search URL ---");
    await browser.goto(targetUrl);
    await browser.randomDelay(2000, 3000);

    // Step 3: Extraction Run
    console.log("\n--- Step 3: Performing Job Card Extraction ---");
    const cards = await extractJobCards(browser.page, { maxCards: 20 });
    console.log(`📦 Cards extracted from DOM: ${cards.length}`);

    const res = store.saveJobs(cards);
    console.log("\n💾 Persistence Statistics:");
    console.log(`   • New jobs added:      ${res.newCount}`);
    console.log(`   • Already known jobs:  ${res.existingCount}`);
    console.log(`   • Total jobs in store: ${res.totalCount}`);

    // Step 4: Apply Filter Rules using loaded config
    console.log("\n--- Step 4: Applying Filter Rules from config/default.json ---");
    const filterResults = store.applyFiltersAndSave(config);

    // Print sample extracted job
    const storedJobs = store.getAllJobs();
    if (storedJobs.length > 0) {
      console.log("\n📄 Sample Structured Job Record (After Filtering):");
      console.log(JSON.stringify(storedJobs[0], null, 2));
    }
  } catch (err) {
    console.error("❌ Pipeline Execution Error:", err);
  } finally {
    await browser.close();
  }
})();
