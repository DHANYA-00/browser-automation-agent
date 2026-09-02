// MANUALLY EXECUTED DEV UTILITY SCRIPT (Not run in automated CI)
// Usage: node scripts/test-job-search.js

const Browser = require("../src/browser/browser");
const { buildSearchUrl, extractJobCards, JobStore } = require("../src/linkedin");

(async () => {
  console.log("=================================================");
  console.log("🔍 LINKEDIN JOB SEARCH & DEDUPE DEMO SCRIPT");
  console.log("=================================================\n");

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
  console.log(`📌 Filter Parameters:`, searchParams);
  console.log(`🔗 Generated Search URL: ${targetUrl}\n`);

  const browser = new Browser();
  try {
    await browser.launch();

    // 1. Authenticate using saved session state
    console.log("--- Step 1: Authenticating Session ---");
    const authenticated = await browser.loginLinkedIn(SESSION_PATH);
    if (!authenticated) {
      console.error("❌ LinkedIn authentication failed. Please run login script first.");
      process.exit(1);
    }

    // 2. Navigate to search URL
    console.log("\n--- Step 2: Navigating to Search URL ---");
    await browser.goto(targetUrl);
    await browser.randomDelay(2000, 3000);

    // 3. First Extraction Run
    console.log("\n--- Step 3: Performing First Extraction Run ---");
    const cardsRun1 = await extractJobCards(browser.page, { maxCards: 20 });
    console.log(`📦 Cards extracted from DOM in Run 1: ${cardsRun1.length}`);

    const res1 = store.saveJobs(cardsRun1);
    console.log("\n💾 Persistence Statistics (Run 1):");
    console.log(`   • New jobs added:      ${res1.newCount}`);
    console.log(`   • Already known jobs:  ${res1.existingCount}`);
    console.log(`   • Total jobs in store: ${res1.totalCount}`);

    // 4. Second Extraction Run (Testing Deduplication)
    console.log("\n--- Step 4: Performing Second Extraction Run (Testing Deduplication) ---");
    const cardsRun2 = await extractJobCards(browser.page, { maxCards: 20 });
    console.log(`📦 Cards extracted from DOM in Run 2: ${cardsRun2.length}`);

    const res2 = store.saveJobs(cardsRun2);
    console.log("\n💾 Persistence Statistics (Run 2 - Dedupe Check):");
    console.log(`   • New jobs added:      ${res2.newCount}`);
    console.log(`   • Already known jobs:  ${res2.existingCount}`);
    console.log(`   • Total jobs in store: ${res2.totalCount}`);

    if (res2.newCount === 0 && res2.existingCount === cardsRun2.length) {
      console.log("\n🎉 DEDUPLICATION VERIFIED SUCCESSFUL!");
      console.log("   All duplicate jobs were identified and skipped. Existing status was preserved.");
    } else {
      console.log(`\nℹ️ Deduplication Summary: ${res2.newCount} new jobs added, ${res2.existingCount} duplicates skipped.`);
    }

    // Print sample extracted job
    const storedJobs = store.getAllJobs();
    if (storedJobs.length > 0) {
      console.log("\n📄 Sample Structured Job Card Record:");
      console.log(JSON.stringify(storedJobs[0], null, 2));
    }
  } catch (err) {
    console.error("❌ Test Script Error:", err);
  } finally {
    await browser.close();
  }
})();
