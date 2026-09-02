class Observer {
  constructor(browser) {
    this.browser = browser;
  }

  async getInteractiveElements() {
    if (!this.browser || !this.browser.page) {
      return [];
    }

    try {
      return await this.browser.page.evaluate(() => {
        // Helper function to generate a stable, non-obfuscated selector
        function generateSelector(el) {
          // 1. Prefer data-testid or similar data-test attributes
          for (const attr of ['data-testid', 'data-test', 'data-qa', 'data-cy']) {
            const val = el.getAttribute(attr);
            if (val) {
              return `[${attr}="${val.replace(/"/g, '\\"')}"]`;
            }
          }

          // 2. Prefer aria-label if present and unique on the page
          const ariaLabel = el.getAttribute('aria-label');
          if (ariaLabel) {
            const tag = el.tagName.toLowerCase();
            const selector = `${tag}[aria-label="${ariaLabel.replace(/"/g, '\\"')}"]`;
            if (document.querySelectorAll(selector).length === 1) {
              return selector;
            }
          }

          // 3. Use stable ID if available (ignoring auto-generated IDs with dynamic prefixes or long numbers)
          if (
            el.id &&
            !/\d{5,}/.test(el.id) &&
            !/^(ember|react-|jsx-|vue-)/i.test(el.id)
          ) {
            const idSelector = `#${CSS.escape(el.id)}`;
            if (document.querySelectorAll(idSelector).length === 1) {
              return idSelector;
            }
          }

          // 4. Use unique name attribute for inputs/selects
          if (el.name) {
            const tag = el.tagName.toLowerCase();
            const nameSelector = `${tag}[name="${el.name.replace(/"/g, '\\"')}"]`;
            if (document.querySelectorAll(nameSelector).length === 1) {
              return nameSelector;
            }
          }

          // 5. Fallback: Generate hierarchical nth-of-type selector path without relying on class names
          const path = [];
          let current = el;

          while (current && current.nodeType === Node.ELEMENT_NODE && current.tagName !== 'HTML') {
            // Stop ascending if an ancestor has a data-testid or stable id
            if (current !== el) {
              const testId = current.getAttribute('data-testid') || current.getAttribute('data-test');
              if (testId) {
                path.unshift(`[data-testid="${testId.replace(/"/g, '\\"')}"]`);
                break;
              }
              if (
                current.id &&
                !/\d{5,}/.test(current.id) &&
                !/^(ember|react-|jsx-|vue-)/i.test(current.id) &&
                document.querySelectorAll(`#${CSS.escape(current.id)}`).length === 1
              ) {
                path.unshift(`#${CSS.escape(current.id)}`);
                break;
              }
            }

            const tag = current.tagName.toLowerCase();
            if (tag === 'body') {
              path.unshift('body');
              break;
            }

            const parent = current.parentElement;
            if (!parent) {
              path.unshift(tag);
              break;
            }

            const siblings = Array.from(parent.children).filter(
              (child) => child.tagName === current.tagName
            );

            if (siblings.length > 1) {
              const index = siblings.indexOf(current) + 1;
              path.unshift(`${tag}:nth-of-type(${index})`);
            } else {
              path.unshift(tag);
            }

            current = parent;
          }

          return path.join(' > ');
        }

        // Find visible interactive elements
        const candidates = Array.from(
          document.querySelectorAll('a, button, input, select, [role="button"], [role="link"]')
        );

        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

        const items = [];

        for (const el of candidates) {
          // Filter out disabled elements
          if (el.disabled || el.getAttribute('aria-disabled') === 'true') {
            continue;
          }

          // Filter out non-visible elements (0 size, hidden display/visibility/opacity)
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) {
            continue;
          }

          const style = window.getComputedStyle(el);
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0'
          ) {
            continue;
          }

          // Filter out elements clipped or positioned off-screen
          if (rect.bottom < 0 || rect.right < 0 || rect.top > document.documentElement.scrollHeight) {
            continue;
          }

          // Check if element is currently inside visible viewport
          const inViewport =
            rect.top < viewportHeight &&
            rect.bottom > 0 &&
            rect.left < viewportWidth &&
            rect.right > 0;

          // Visible text or label (innerText, or aria-label/placeholder/title/value)
          let text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
          if (!text) {
            text =
              el.getAttribute('aria-label') ||
              el.getAttribute('placeholder') ||
              el.getAttribute('title') ||
              el.getAttribute('value') ||
              '';
          }

          const tag = el.tagName.toLowerCase();
          const type = el.getAttribute('type') || tag;
          const selector = generateSelector(el);

          items.push({
            tag,
            type,
            text,
            selector,
            inViewport,
          });
        }

        // Prioritize elements in the viewport, capped at 50
        items.sort((a, b) => (b.inViewport ? 1 : 0) - (a.inViewport ? 1 : 0));

        return items.slice(0, 50).map(({ tag, type, text, selector }) => ({
          tag,
          type,
          text,
          selector,
        }));
      });
    } catch (error) {
      if (error.message && error.message.includes("Execution context was destroyed")) {
        await this.browser.page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
        return await this.browser.page
          .evaluate(() => {
            const candidates = Array.from(
              document.querySelectorAll('a, button, input, select, [role="button"], [role="link"]')
            );
            return candidates.slice(0, 50).map((el) => ({
              tag: el.tagName.toLowerCase(),
              type: el.getAttribute('type') || el.tagName.toLowerCase(),
              text: (el.innerText || el.textContent || '').trim(),
              selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
            }));
          })
          .catch(() => []);
      }
      return [];
    }
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

    await this.browser.screenshot("current.png").catch(() => {});

    return {
      title,
      url,
      screenshot: "screenshots/current.png",
      elements,
    };
  }
}

module.exports = Observer;