const { chromium } = require('playwright');

class Browser {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isConnectedViaCDP = false;
  }

  /**
   * Initializes browser connection.
   * Connects via CDP to port 9222 first; falls back to standard launch if unavailable.
   */
  async launch(options = { cdpUrl: 'http://localhost:9222', fallbackHeadless: false }) {
    const cdpUrl = options.cdpUrl || 'http://localhost:9222';

    try {
      console.log(`[Browser] Attempting CDP connection at ${cdpUrl}...`);
      this.browser = await chromium.connectOverCDP(cdpUrl);

      const contexts = this.browser.contexts();
      this.context = contexts.length > 0 ? contexts[0] : await this.browser.newContext();

      // Open a dedicated new tab for automation without interfering with existing user tabs.
      this.page = await this.context.newPage();
      this.isConnectedViaCDP = true;
      console.log('[Browser] Connected to the existing Chrome instance via CDP. Created a new automation tab.');
      return this.page;
    } catch (err) {
      console.warn(`[Browser] CDP connection failed (${err.message}). Falling back to a standard Playwright launch.`);
      this.isConnectedViaCDP = false;
    }

    // Fallback: Launch a standard isolated Playwright instance.
    this.browser = await chromium.launch({ headless: options.fallbackHeadless });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
    console.log('[Browser] Standard Playwright browser launched.');
    return this.page;
  }

  async goto(url) {
    if (!this.page) throw new Error('Browser page not initialized. Call launch() first.');
    return await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async click(selector) {
    await this.page.waitForSelector(selector, { state: 'visible' });
    return await this.page.click(selector);
  }

  async type(selector, text) {
    await this.page.waitForSelector(selector, { state: 'visible' });
    return await this.page.fill(selector, text);
  }

  async press(selector, key) {
    await this.page.waitForSelector(selector, { state: 'visible' });
    return await this.page.press(selector, key);
  }

  async scrollDown(pixels = 500) {
    return await this.page.evaluate((px) => window.scrollBy(0, px), pixels);
  }

  async scrollUp(pixels = 500) {
    return await this.page.evaluate((px) => window.scrollBy(0, -px), pixels);
  }

  async wait(ms) {
    return await this.page.waitForTimeout(ms);
  }

  async waitForSelector(selector, timeout = 10000) {
    return await this.page.waitForSelector(selector, { timeout });
  }

  async screenshot(path) {
    return await this.page.screenshot({ path, fullPage: false });
  }

  async getTitle() {
    return await this.page.title();
  }

  async getUrl() {
    return this.page.url();
  }

  async getText(selector) {
    return await this.page.textContent(selector);
  }

  async close() {
    if (this.page && !this.page.isClosed()) {
      await this.page.close();
    }

    // In CDP mode, keep the existing Chrome process alive; only close the automation tab.
    if (this.browser && !this.isConnectedViaCDP) {
      await this.browser.close();
    }

    this.page = null;
    this.context = null;
    this.browser = null;
    this.isConnectedViaCDP = false;
  }
}

module.exports = Browser;