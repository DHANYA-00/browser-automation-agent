const { chromium } = require("playwright");

class Browser {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async launch() {
    this.browser = await chromium.launch({
      headless: false,
    });

    this.page = await this.browser.newPage();

    console.log("🌐 Browser launched");
  }

  async goto(url) {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    await this.page.goto(url, {
      waitUntil: "domcontentloaded",
    });

    console.log(`🌍 Navigated to: ${url}`);
  }

  async click(selector) {
    await this.page.locator(selector).click();

    console.log(`🖱️ Clicked: ${selector}`);
  }

  async type(selector, text) {
    await this.page.locator(selector).fill(text);

    console.log(`⌨️ Typed into: ${selector}`);
  }

  async press(key) {
    await this.page.keyboard.press(key);

    console.log(`⌨️ Pressed: ${key}`);
  }

  async hover(selector) {
    await this.page.locator(selector).hover();

    console.log(`🖱️ Hovered: ${selector}`);
  }

  async scrollDown(amount = 600) {
    await this.page.evaluate((amount) => {
      window.scrollBy(0, amount);
    }, amount);

    console.log(`⬇️ Scrolled down ${amount}px`);
  }

  async scrollUp(amount = 600) {
    await this.page.evaluate((amount) => {
      window.scrollBy(0, -amount);
    }, amount);

    console.log(`⬆️ Scrolled up ${amount}px`);
  }

  async wait(ms) {
    await this.page.waitForTimeout(ms);

    console.log(`⏳ Waited ${ms}ms`);
  }

  async waitForSelector(selector) {
    await this.page.locator(selector).waitFor({
      state: "visible",
    });

    console.log(`👀 Element visible: ${selector}`);
  }

  async screenshot(name = "page.png") {
    if (!this.page || this.page.isClosed()) return;
    try {
      const fs = require("fs");
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
    return await this.page.title();
  }

  getUrl() {
    return this.page.url();
  }

  async getText(selector) {
    return await this.page.locator(selector).innerText();
  }

  async reload() {
    await this.page.reload({
      waitUntil: "domcontentloaded",
    });
  }

  async back() {
    await this.page.goBack();
  }

  async forward() {
    await this.page.goForward();
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log("🔴 Browser closed");
    }
  }
}

module.exports = Browser;