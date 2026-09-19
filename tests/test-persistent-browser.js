const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Browser = require("../src/browser/browser");

(async () => {
  console.log("=================================================");
  console.log("🧪 TESTING PERSISTENT NON-INCOGNITO BROWSER MODE");
  console.log("=================================================\n");

  const testProfileDir = path.join(__dirname, "temp-test-chrome-profile");
  if (fs.existsSync(testProfileDir)) {
    fs.rmSync(testProfileDir, { recursive: true, force: true });
  }

  // --- RUN 1: Launch Persistent Browser & Set Persistent Cookie & LocalStorage ---
  console.log("--- Run 1: Launch persistent browser and set state ---");
  const browser1 = new Browser();
  try {
    await browser1.launch({
      headless: true,
      userDataDir: testProfileDir,
      persistent: true,
    });

    assert.strictEqual(browser1.isPersistent, true, "Browser should be in persistent mode");
    assert.ok(fs.existsSync(testProfileDir), "Persistent profile directory should exist on disk");

    // Navigate and set persistent cookie & localStorage
    await browser1.goto("https://example.com");

    const oneDayFuture = Math.floor(Date.now() / 1000) + 86400;
    await browser1.context.addCookies([
      {
        name: "test_persistent_token",
        value: "linkedin_persistent_token_12345",
        domain: ".example.com",
        path: "/",
        expires: oneDayFuture,
        httpOnly: false,
        secure: true,
      },
    ]);

    await browser1.page.evaluate(() => {
      localStorage.setItem("persistent_key", "saved_linkedin_state");
    });

    const cookiesRun1 = await browser1.context.cookies(["https://example.com"]);
    const hasTokenRun1 = cookiesRun1.some((c) => c.name === "test_persistent_token");
    assert.strictEqual(hasTokenRun1, true, "Cookie should be set in Run 1");
    console.log("✅ Run 1: Persistent cookie and localStorage saved in profile.");
  } finally {
    await browser1.close();
  }

  // --- RUN 2: Re-launch with Same Profile & Verify Persistence ---
  console.log("\n--- Run 2: Re-launch with same persistent profile ---");
  const browser2 = new Browser();
  try {
    await browser2.launch({
      headless: true,
      userDataDir: testProfileDir,
      persistent: true,
    });

    assert.strictEqual(browser2.isPersistent, true, "Browser should be in persistent mode");

    await browser2.goto("https://example.com");
    const cookiesRun2 = await browser2.context.cookies(["https://example.com"]);
    const persistentCookie = cookiesRun2.find((c) => c.name === "test_persistent_token");

    assert.ok(
      persistentCookie,
      "Cookie must persist across browser restarts in non-incognito persistent mode!"
    );
    assert.strictEqual(
      persistentCookie.value,
      "linkedin_persistent_token_12345",
      "Persistent cookie value should match"
    );

    const storedValue = await browser2.page.evaluate(() => {
      return localStorage.getItem("persistent_key");
    });
    assert.strictEqual(
      storedValue,
      "saved_linkedin_state",
      "LocalStorage must persist across runs in persistent mode"
    );

    console.log("✅ Run 2: Verified cookie and localStorage persisted across separate browser sessions (Non-Incognito verified)!");
  } finally {
    await browser2.close();
    if (fs.existsSync(testProfileDir)) {
      fs.rmSync(testProfileDir, { recursive: true, force: true });
    }
  }

  console.log("\n🎉 ALL PERSISTENT BROWSER TESTS PASSED SUCCESSFULLY!");
})();
