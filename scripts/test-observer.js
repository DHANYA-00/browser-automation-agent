// MANUALLY EXECUTED DEV UTILITY SCRIPT (Not run in automated CI)
// Usage: node scripts/test-observer.js

const Browser = require("../src/browser/browser");
const Observer = require("../src/agent/observer");

(async () => {
  const browser = new Browser();

  try {
    await browser.launch();
    await browser.goto("https://en.wikipedia.org/wiki/Playwright_(software)");

    const observer = new Observer(browser);
    const result = await observer.observe();

    console.log("=== Observation Summary ===");
    console.log("Title:", result.title);
    console.log("URL:", result.url);
    console.log("Screenshot:", result.screenshot);
    console.log("\n=== Extracted Interactive Elements (Count:", result.elements.length, ") ===");
    console.dir(result.elements, { depth: null, maxArrayLength: null });
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await browser.close();
  }
})();
