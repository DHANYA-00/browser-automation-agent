class Observer {
  constructor(browser) {
    this.browser = browser;
  }

  normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  async getInteractiveElements() {
    if (!this.browser || !this.browser.page) {
      return [];
    }

    try {
      return await this.browser.page.evaluate(() => {
        function generateSelector(el) {
          const stableAttrs = ["data-testid", "data-test", "data-qa", "data-cy", "name"];
          for (const attr of stableAttrs) {
            const val = el.getAttribute(attr);
            if (!val) continue;
            const selector = attr === "name"
              ? `${el.tagName.toLowerCase()}[${attr}="${val.replace(/"/g, '\\"')}"]`
              : `[${attr}="${val.replace(/"/g, '\\"')}"]`;
            if (document.querySelectorAll(selector).length === 1) {
              return selector;
            }
          }

          const ariaLabel = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
          if (ariaLabel) {
            const tag = el.tagName.toLowerCase();
            const selector = `${tag}[aria-label="${ariaLabel.replace(/"/g, '\\"')}"]`;
            if (document.querySelectorAll(selector).length === 1) {
              return selector;
            }
          }

          if (el.id && !/\d{5,}/.test(el.id) && !/^(ember|react-|jsx-|vue-)/i.test(el.id)) {
            const selector = `#${CSS.escape(el.id)}`;
            if (document.querySelectorAll(selector).length === 1) {
              return selector;
            }
          }

          const path = [];
          let current = el;

          while (current && current.nodeType === Node.ELEMENT_NODE && current.tagName !== "HTML") {
            const tag = current.tagName.toLowerCase();
            if (tag === "body") {
              path.unshift("body");
              break;
            }

            const parent = current.parentElement;
            if (!parent) {
              path.unshift(tag);
              break;
            }

            const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
            if (siblings.length > 1) {
              path.unshift(`${tag}:nth-of-type(${siblings.indexOf(current) + 1})`);
            } else {
              path.unshift(tag);
            }

            current = parent;
          }

          return path.join(" > ");
        }

        const candidates = Array.from(
          document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="link"], [role="textbox"]')
        );

        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

        const items = [];
        for (const el of candidates) {
          if (el.disabled || el.getAttribute("aria-disabled") === "true") {
            continue;
          }

          const rect = el.getBoundingClientRect();
          if (!rect || (rect.width === 0 && rect.height === 0)) {
            continue;
          }

          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
            continue;
          }

          const inViewport =
            rect.top < viewportHeight &&
            rect.bottom > 0 &&
            rect.left < viewportWidth &&
            rect.right > 0;

          let text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
          if (!text) {
            text =
              el.getAttribute("aria-label") ||
              el.getAttribute("placeholder") ||
              el.getAttribute("title") ||
              el.getAttribute("value") ||
              "";
          }

          const tag = el.tagName.toLowerCase();
          const type = el.getAttribute("type") || tag;
          const selector = generateSelector(el);

          items.push({ tag, type, text, selector, inViewport });
        }

        items.sort((a, b) => (b.inViewport ? 1 : 0) - (a.inViewport ? 1 : 0));
        return items.slice(0, 50).map(({ tag, type, text, selector }) => ({ tag, type, text, selector }));
      });
    } catch (error) {
      return [];
    }
  }

  async extractLinkedInJobs() {
    if (!this.browser || !this.browser.page || this.browser.page.isClosed()) {
      return [];
    }

    return this.browser.page.evaluate(() => {
      const normalizeText = (value) => (value || "").replace(/\s+/g, " ").trim();

      const scoreText = (text) => {
        if (!text) return 0;
        const lower = text.toLowerCase();
        if (lower.includes("remote") || lower.includes("hybrid") || lower.includes("on-site") || lower.includes("onsite")) return 3;
        if (/[a-z]/i.test(lower)) return 1;
        return 0;
      };

      const findTextInCard = (card, selectors) => {
        for (const selector of selectors) {
          const nodes = card.querySelectorAll(selector);
          for (const node of nodes) {
            const text = normalizeText(node.innerText || node.textContent || "");
            if (text) return text;
          }
        }
        return "";
      };

      const getJobUrl = (card) => {
        const links = card.querySelectorAll('a[href*="/jobs/"], a[href*="/job/"], [role="link"][href*="/jobs/"]');
        for (const link of links) {
          const href = link.href || link.getAttribute("href");
          if (href && /\/jobs\//i.test(href)) {
            return href;
          }
        }

        return "";
      };

      const getBestLocation = (card) => {
        const nodes = Array.from(card.querySelectorAll("span, div, li, p"));
        const results = [];
        for (const node of nodes) {
          const text = normalizeText(node.innerText || node.textContent || "");
          if (!text) continue;
          const lower = text.toLowerCase();
          if (lower.includes("remote") || lower.includes("hybrid") || lower.includes("on-site") || lower.includes("onsite") || /[a-z]+,\s*[a-z]+/i.test(text) || /[a-z]/i.test(text)) {
            if (!text.includes("Apply now") && !text.includes("Easy Apply") && !text.includes("Save")) {
              results.push({ text, score: scoreText(text) });
            }
          }
        }

        results.sort((a, b) => b.score - a.score);
        return results[0]?.text || "";
      };

      const candidates = Array.from(document.querySelectorAll("article, li, div, section"));
      const jobs = [];

      for (const card of candidates) {
        const text = normalizeText(card.innerText || card.textContent || "");
        if (!text || text.length > 2000) continue;

        const jobUrl = getJobUrl(card);
        if (!jobUrl) continue;

        const jobTitle =
          findTextInCard(card, ["h2", "h3", "h4", "[role='heading']", "a[href*='/jobs/']", "a[href*='/job/']"]) ||
          normalizeText(card.getAttribute("aria-label")) ||
          "";

        const companyName =
          findTextInCard(card, ["a[href*='/company/']", "[data-company-name]", "span[aria-label*='company' i]", "div[aria-label*='company' i]"]) ||
          "";

        const location = getBestLocation(card);

        if (!jobTitle) continue;

        jobs.push({
          jobTitle,
          companyName,
          location,
          jobUrl,
        });
      }

      const uniqueJobs = [];
      const seen = new Set();
      for (const job of jobs) {
        const key = `${job.jobTitle}|${job.companyName}|${job.jobUrl}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueJobs.push(job);
        }
      }

      return uniqueJobs.slice(0, 12);
    });
  }

  async observe() {
    if (this.browser) {
      await this.browser.ensurePage().catch(() => {});
      if (this.browser.page && !this.browser.page.isClosed()) {
        await this.browser.page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
      }
    }

    const title = await this.browser.getTitle().catch(() => "");
    const url = this.browser.getUrl();
    const elements = await this.getInteractiveElements().catch(() => []);
    const visibleText = await this.browser.page
      .evaluate(() => {
        const bodyText = document.body ? document.body.innerText || document.body.textContent || "" : "";
        return (bodyText || "").replace(/\s+/g, " ").trim();
      })
      .catch(() => "");

    const jobs = await this.extractLinkedInJobs().catch(() => []);
    const currentPageState = {
      isLinkedIn: /linkedin\.com/i.test(url || ""),
      isJobSearchResults: /linkedin\.com\/jobs\//i.test(url || ""),
      resultCount: jobs.length,
      hasVisibleJobs: jobs.length > 0,
    };

    await this.browser.screenshot("current.png").catch(() => {});

    return {
      url,
      title,
      visibleText,
      jobs,
      currentPageState,
      screenshot: "screenshots/current.png",
      elements,
    };
  }
}

module.exports = Observer;
