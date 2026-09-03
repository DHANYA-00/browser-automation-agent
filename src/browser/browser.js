const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { buildSearchUrl, extractJobCards } = require("../linkedin/jobSearch");

class Browser {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async launch(options = {}) {
    const isCI = !!process.env.CI;
    this.browser = await chromium.launch({
      headless: isCI ? true : false,
      ...options,
    });

    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();

    console.log("🌐 Browser launched");
  }

  async randomDelay(min = 500, max = 1500) {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    await this.wait(ms);
  }

  async saveSession(sessionPath = "data/session.json") {
    if (!this.context) {
      throw new Error("No browser context available to save session.");
    }
    const dir = path.dirname(sessionPath);
    if (dir && dir !== "." && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await this.context.storageState({ path: sessionPath });
    console.log(`💾 Session saved to ${sessionPath}`);
  }

  async loadSession(sessionPath = "data/session.json") {
    if (!fs.existsSync(sessionPath)) {
      return false;
    }
    try {
      if (this.context) {
        await this.context.close().catch(() => {});
      }
      this.context = await this.browser.newContext({ storageState: sessionPath });
      this.page = await this.context.newPage();
      console.log(`🔑 Loaded session from ${sessionPath}`);
      return true;
    } catch (err) {
      console.warn(`⚠️ Failed to load session from ${sessionPath}: ${err.message}`);
      return false;
    }
  }

  async verifyLoggedInLinkedIn() {
    try {
      await this.goto("https://www.linkedin.com/feed");
      await this.randomDelay(1000, 2000);

      const url = this.getUrl();
      if (url.includes("/login") || url.includes("/signup") || url.includes("/checkpoint")) {
        return false;
      }

      // Race check between logged-in UI elements vs login form elements
      const isLoggedIn = await Promise.race([
        this.page
          .waitForSelector(
            'nav.global-nav, #global-nav, img.global-nav__me-photo, .feed-identity-module, input.search-global-typeahead__input, a[href*="/feed"]',
            { timeout: 8000 }
          )
          .then(() => true)
          .catch(() => false),
        this.page
          .waitForSelector(
            'input#username, input[name="session_key"], button[data-litms-control-code="login-submit"]',
            { timeout: 8000 }
          )
          .then(() => false)
          .catch(() => false),
      ]);

      return isLoggedIn;
    } catch (err) {
      return false;
    }
  }

  async loginLinkedIn(sessionPath = "data/session.json") {
    console.log("\n🔒 Checking LinkedIn session and authentication state...");

    // 1. Check for existing session file
    if (fs.existsSync(sessionPath)) {
      const loaded = await this.loadSession(sessionPath);
      if (loaded) {
        console.log("🔍 Verifying loaded session on LinkedIn feed...");
        const isValid = await this.verifyLoggedInLinkedIn();
        if (isValid) {
          console.log("🎉 Valid session found! Successfully authenticated without re-logging in.");
          return true;
        } else {
          console.log("⚠️ Saved session is expired or invalid. Falling back to fresh login flow...");
        }
      }
    } else {
      console.log("ℹ️ No session file found. Initiating fresh login flow...");
    }

    // 2. Perform fresh login flow
    await this.goto("https://www.linkedin.com/login");
    await this.randomDelay(1000, 2000);

    const email = process.env.LINKEDIN_EMAIL;
    const password = process.env.LINKEDIN_PASSWORD;

    if (!email || !password) {
      console.warn(
        "⚠️ LINKEDIN_EMAIL or LINKEDIN_PASSWORD environment variables not set."
      );
      console.log("👉 Please perform manual login in the browser window...");
    } else {
      console.log("🔑 Filling credentials with human-like delays...");
      await this.randomDelay(500, 1000);

      const usernameSelector = 'input#username, input[name="session_key"]';
      await this.page.locator(usernameSelector).click();
      await this.randomDelay(300, 700);
      await this.page.locator(usernameSelector).fill(email);
      await this.randomDelay(800, 1500);

      const passwordSelector = 'input#password, input[name="session_password"]';
      await this.page.locator(passwordSelector).click();
      await this.randomDelay(300, 700);
      await this.page.locator(passwordSelector).fill(password);
      await this.randomDelay(1000, 2000);

      const submitBtn = 'button[type="submit"], button[aria-label*="Sign in"]';
      await this.page.locator(submitBtn).click();
      console.log("🖱️ Submitted login form");
    }

    // 3. Detect and handle security checkpoint / 2FA / CAPTCHA
    await this.randomDelay(2000, 4000);
    const currentUrl = this.getUrl();

    if (
      currentUrl.includes("/checkpoint/") ||
      currentUrl.includes("/challenge/") ||
      (await this.page.$('input[name="pin"], #captcha, .captcha'))
    ) {
      console.log("\n=================================================");
      console.log("⚠️ SECURITY CHALLENGE / 2FA / CAPTCHA DETECTED!");
      console.log("👉 Please complete verification manually in the browser window.");
      console.log("=================================================\n");

      await this.page.waitForURL(
        (url) => !url.href.includes("/checkpoint/") && !url.href.includes("/login"),
        { timeout: 180000 }
      );
    }

    // 4. Verify post-login state and save session
    console.log("⏳ Waiting for feed navigation to settle...");
    await this.randomDelay(2000, 3000);
    const success = await this.verifyLoggedInLinkedIn();

    if (success) {
      await this.saveSession(sessionPath);
      console.log("✅ LinkedIn login complete and session saved!");
      return true;
    } else {
      console.error("❌ LinkedIn login verification failed.");
      return false;
    }
  }

  async ensurePage() {
    if (!this.browser || !this.browser.isConnected()) {
      await this.launch();
    } else if (!this.context) {
      this.context = await this.browser.newContext();
      this.page = await this.context.newPage();
    } else if (!this.page || this.page.isClosed()) {
      this.page = await this.context.newPage();
    }
    return this.page;
  }

  async goto(url) {
    await this.ensurePage();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    await this.page.goto(url, {
      waitUntil: "domcontentloaded",
    });

    console.log(`🌍 Navigated to: ${url}`);
  }

  async click(selector, options = {}) {
    await this.ensurePage();
    const timeout = options.timeout || 5000;
    await this.page.locator(selector).click({ timeout, ...options });
    console.log(`🖱️ Clicked: ${selector}`);
  }

  async type(selector, text, options = {}) {
    await this.ensurePage();
    const timeout = options.timeout || 5000;
    await this.page.locator(selector).fill(text, { timeout, ...options });
    console.log(`⌨️ Typed into: ${selector}`);
  }

  async press(key, options = {}) {
    await this.ensurePage();
    await this.page.keyboard.press(key, options);
    console.log(`⌨️ Pressed: ${key}`);
  }

  async hover(selector, options = {}) {
    await this.ensurePage();
    const timeout = options.timeout || 5000;
    await this.page.locator(selector).hover({ timeout, ...options });
    console.log(`🖱️ Hovered: ${selector}`);
  }

  async scrollDown(amount = 600) {
    await this.ensurePage();
    await this.page.evaluate((amount) => {
      window.scrollBy(0, amount);
    }, amount);
    console.log(`⬇️ Scrolled down ${amount}px`);
  }

  async scrollUp(amount = 600) {
    await this.ensurePage();
    await this.page.evaluate((amount) => {
      window.scrollBy(0, -amount);
    }, amount);
    console.log(`⬆️ Scrolled up ${amount}px`);
  }

  async wait(ms) {
    await this.ensurePage();
    await this.page.waitForTimeout(ms);
    console.log(`⏳ Waited ${ms}ms`);
  }

  async selectOption(selector, option, options = {}) {
    await this.ensurePage();
    const timeout = options.timeout || 5000;
    await this.page.locator(selector).selectOption(option, { timeout, ...options });
    console.log(`Dropdown selected [${selector}]: ${JSON.stringify(option)}`);
  }

  async check(selector, options = {}) {
    await this.ensurePage();
    const timeout = options.timeout || 5000;
    await this.page.locator(selector).check({ timeout, ...options });
    console.log(`☑️ Checked: ${selector}`);
  }

  async uncheck(selector, options = {}) {
    await this.ensurePage();
    const timeout = options.timeout || 5000;
    await this.page.locator(selector).uncheck({ timeout, ...options });
    console.log(`☐ Unchecked: ${selector}`);
  }

  async setInputFiles(selector, files, options = {}) {
    await this.ensurePage();
    const timeout = options.timeout || 5000;
    await this.page.locator(selector).setInputFiles(files, { timeout, ...options });
    console.log(`📁 Uploaded file(s) [${selector}]: ${JSON.stringify(files)}`);
  }

  async waitForSelector(selector, options = {}) {
    await this.ensurePage();
    const timeout = options.timeout || 5000;
    await this.page.locator(selector).waitFor({
      state: "visible",
      timeout,
      ...options,
    });
    console.log(`👀 Element visible: ${selector}`);
  }

  async screenshot(name = "page.png") {
    if (!this.page || this.page.isClosed()) return;
    try {
      if (!fs.existsSync("screenshots")) {
        fs.mkdirSync("screenshots", { recursive: true });
      }
      await this.page.screenshot({
        path: `screenshots/${name}`,
      });
      console.log(`📸 Screenshot: screenshots/${name}`);
    } catch (err) {
      console.warn(`⚠️ Screenshot capture skipped: ${err.message}`);
    }
  }

  async getTitle() {
    if (!this.page || this.page.isClosed()) return "";
    try {
      return await this.page.title();
    } catch {
      return "";
    }
  }

  getUrl() {
    if (!this.page || this.page.isClosed()) return "";
    try {
      return this.page.url();
    } catch {
      return "";
    }
  }

  async getText(selector) {
    await this.ensurePage();
    return await this.page.locator(selector).innerText();
  }

  async reload() {
    await this.ensurePage();
    await this.page.reload({
      waitUntil: "domcontentloaded",
    });
  }

  async back() {
    await this.ensurePage();
    await this.page.goBack();
  }

  async forward() {
    await this.ensurePage();
    await this.page.goForward();
  }

  buildSearchUrl(options = {}) {
    return buildSearchUrl(options);
  }

  async extractJobCards(options = {}) {
    await this.ensurePage();
    return await extractJobCards(this.page, options);
  }

  async close() {
    if (this.context) {
      await this.context.close().catch(() => {});
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      console.log("🔴 Browser closed");
    }
  }
}

module.exports = Browser;