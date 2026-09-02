const Browser = require("../src/browser/browser");
const { extractJobCards, JobStore } = require("../src/linkedin");
const assert = require("assert");
const fs = require("fs");
const path = require("path");

(async () => {
  console.log("=================================================");
  console.log("🧪 RUNNING PLAYWRIGHT DOM EXTRACTION TEST");
  console.log("=================================================\n");

  const mockHtml = `
    <!DOCTYPE html>
    <html>
    <head><title>Mock LinkedIn Jobs Search</title></head>
    <body>
      <div class="jobs-search-results-list" style="height: 300px; overflow-y: scroll;">
        <ul class="jobs-search-results__list">
          <li class="jobs-search-results__list-item" data-job-id="3991001">
            <div class="job-card-container">
              <a class="job-card-list__title" href="/jobs/view/3991001/">Lead Full Stack Engineer</a>
              <div class="job-card-container__company-name">TechCorp Global</div>
              <div class="job-card-container__metadata-item">Remote, US</div>
              <time datetime="2026-09-01">1 hour ago</time>
              <span class="job-card-container__easy-apply">Easy Apply</span>
            </div>
          </li>
          <li class="jobs-search-results__list-item" data-job-id="3991002">
            <div class="job-card-container">
              <a class="job-card-list__title" href="/jobs/view/3991002/">Senior Node.js Developer</a>
              <div class="job-card-container__company-name">Innovate Solutions</div>
              <div class="job-card-container__metadata-item">San Francisco, CA</div>
              <time datetime="2026-08-31">1 day ago</time>
            </div>
          </li>
        </ul>
      </div>
    </body>
    </html>
  `;

  const browser = new Browser();
  const TEST_FILE = path.join(__dirname, "temp_mock_extracted_jobs.json");
  if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);

  try {
    await browser.launch({ headless: true });
    await browser.page.setContent(mockHtml);

    console.log("📄 Loaded mock HTML into Playwright page.");

    const cards = await extractJobCards(browser.page, { maxCards: 10, timeout: 2000 });
    console.log(`📦 Extracted ${cards.length} cards from mock page:`);
    console.log(JSON.stringify(cards, null, 2));

    assert.strictEqual(cards.length, 2, "Should extract 2 job cards");
    
    // Check Card 1 details
    assert.strictEqual(cards[0].id, "3991001");
    assert.strictEqual(cards[0].title, "Lead Full Stack Engineer");
    assert.strictEqual(cards[0].company, "TechCorp Global");
    assert.strictEqual(cards[0].location, "Remote, US");
    assert.strictEqual(cards[0].postedDate, "1 hour ago");
    assert.strictEqual(cards[0].easyApply, true, "Card 1 must have easyApply = true");

    // Check Card 2 details
    assert.strictEqual(cards[1].id, "3991002");
    assert.strictEqual(cards[1].title, "Senior Node.js Developer");
    assert.strictEqual(cards[1].company, "Innovate Solutions");
    assert.strictEqual(cards[1].location, "San Francisco, CA");
    assert.strictEqual(cards[1].easyApply, false, "Card 2 must have easyApply = false");

    // Test Store Save & Dedupe
    const store = new JobStore(TEST_FILE);
    const save1 = store.saveJobs(cards);
    assert.strictEqual(save1.newCount, 2);

    const save2 = store.saveJobs(cards);
    assert.strictEqual(save2.newCount, 0);
    assert.strictEqual(save2.existingCount, 2);

    console.log("\n✅ PLAYWRIGHT DOM EXTRACTION TEST PASSED PERFECTLY!");
  } catch (err) {
    console.error("❌ Playwright DOM Extraction Test Error:", err);
    process.exit(1);
  } finally {
    if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
    await browser.close();
  }
})();
