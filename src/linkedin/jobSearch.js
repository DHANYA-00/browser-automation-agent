/**
 * LinkedIn Job Search Utilities
 * Contains URL builder and job card DOM extractor.
 */

/**
 * Constructs a LinkedIn jobs search URL from parameter options.
 *
 * @param {Object} options
 * @param {string} [options.keywords] - Search keywords (e.g. "Software Engineer")
 * @param {string} [options.location] - Location filter (e.g. "United States", "Remote")
 * @param {string} [options.datePosted] - Date posted filter ("24h", "past_24h", "week", "past_week", "month", "past_month", or raw f_TPR like "r86400")
 * @param {boolean} [options.easyApplyOnly] - If true, filters for Easy Apply jobs only
 * @returns {string} Fully constructed search URL
 */
function buildSearchUrl({ keywords = "", location = "", datePosted = "", easyApplyOnly = false } = {}) {
  const baseUrl = "https://www.linkedin.com/jobs/search/";
  const params = new URLSearchParams();

  if (keywords && typeof keywords === "string" && keywords.trim()) {
    params.set("keywords", keywords.trim());
  }

  if (location && typeof location === "string" && location.trim()) {
    params.set("location", location.trim());
  }

  if (datePosted) {
    const dp = String(datePosted).toLowerCase().trim();
    if (dp === "24h" || dp === "past_24h" || dp === "past_24_hours" || dp === "day" || dp === "past_day") {
      params.set("f_TPR", "r86400");
    } else if (dp === "week" || dp === "past_week" || dp === "7d") {
      params.set("f_TPR", "r604800");
    } else if (dp === "month" || dp === "past_month" || dp === "30d") {
      params.set("f_TPR", "r2592000");
    } else {
      params.set("f_TPR", dp);
    }
  }

  if (easyApplyOnly) {
    params.set("f_AL", "true");
  }

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Extracts visible job cards from LinkedIn job search results page,
 * scrolling incrementally to lazy-load cards up to maxCards cap.
 *
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {Object} [options]
 * @param {number} [options.maxCards=50] - Maximum number of job cards to extract
 * @param {number} [options.maxScrollAttempts=5] - Consecutive scrolls without new cards before stopping
 * @param {number} [options.scrollDelayMin=800] - Minimum delay between scrolls in ms
 * @param {number} [options.scrollDelayMax=1600] - Maximum delay between scrolls in ms
 * @param {number} [options.timeout=10000] - Timeout waiting for job list in ms
 * @returns {Promise<Array<Object>>} Array of job objects { id, title, company, location, postedDate, easyApply }
 */
async function extractJobCards(page, options = {}) {
  const {
    maxCards = 50,
    maxScrollAttempts = 5,
    scrollDelayMin = 800,
    scrollDelayMax = 1600,
    timeout = 10000,
  } = options;

  console.log("🔍 Waiting for LinkedIn job search results list...");

  const containerSelector = [
    ".jobs-search-results-list",
    ".scaffold-layout__list",
    "ul.jobs-search-results__list",
    "div.job-card-container",
    "div[data-job-id]",
    "li.jobs-search-results__list-item",
    ".jobs-search-results-list__list-item",
    "ul.jobs-search-results-list"
  ].join(", ");

  try {
    await page.waitForSelector(containerSelector, { timeout, state: "attached" });
    console.log("✅ Job search results container loaded.");
  } catch (err) {
    console.warn(`⚠️ Job results container not found within ${timeout}ms.`);
    return [];
  }

  const jobsMap = new Map();
  let attemptsWithoutNew = 0;

  while (jobsMap.size < maxCards && attemptsWithoutNew < maxScrollAttempts) {
    const initialCount = jobsMap.size;

    const extractedCards = await page.evaluate(() => {
      const results = [];
      const cardNodes = document.querySelectorAll(
        "li.jobs-search-results__list-item, div.job-card-container, div[data-job-id], li[data-occluded-card-index], .job-card-list__entity-lockup"
      );

      cardNodes.forEach((card) => {
        let jobId = card.getAttribute("data-job-id") || card.getAttribute("data-occluded-card-urn");

        if (!jobId) {
          const urn = card.getAttribute("data-entity-urn");
          if (urn && urn.includes("jobPosting:")) {
            jobId = urn.split("jobPosting:")[1];
          }
        }

        if (!jobId) {
          const links = Array.from(card.querySelectorAll('a[href*="/jobs/view/"], a[href*="currentJobId="]'));
          for (const link of links) {
            const href = link.getAttribute("href") || "";
            const matchView = href.match(/\/jobs\/view\/(\d+)/);
            const matchQuery = href.match(/currentJobId=(\d+)/);
            if (matchView) {
              jobId = matchView[1];
              break;
            } else if (matchQuery) {
              jobId = matchQuery[1];
              break;
            }
          }
        }

        if (!jobId) return;
        jobId = String(jobId).trim();

        // Extract Title
        const titleEl = card.querySelector(
          ".job-card-list__title, .job-card-container__link, a[data-control-name='job_card_title'], .artdeco-entity-lockup__title, strong, a.job-card-list__title"
        );
        const title = titleEl ? titleEl.innerText.trim().replace(/\s+/g, " ") : "";

        // Extract Company
        const companyEl = card.querySelector(
          ".job-card-container__primary-description, .job-card-container__company-name, .artdeco-entity-lockup__subtitle, .job-card-container__company-link"
        );
        const company = companyEl ? companyEl.innerText.trim().replace(/\s+/g, " ") : "";

        // Extract Location
        const locationEl = card.querySelector(
          ".job-card-container__metadata-item, .job-card-container__secondary-description, .artdeco-entity-lockup__caption, .job-card-container__metadata-wrapper"
        );
        const location = locationEl ? locationEl.innerText.trim().replace(/\s+/g, " ") : "";

        // Extract Posted Date
        const timeEl = card.querySelector("time, .job-card-container__listed-time, time[datetime], .job-card-container__footer-item");
        const postedDate = timeEl ? timeEl.innerText.trim() : "";

        // Easy Apply Tag
        const cardText = card.innerText || "";
        const easyApplyEl = card.querySelector(".job-card-container__apply-method, .job-card-container__easy-apply, [aria-label*='Easy Apply']");
        const easyApply = Boolean(easyApplyEl || cardText.includes("Easy Apply"));

        results.push({
          id: jobId,
          title,
          company,
          location,
          postedDate,
          easyApply,
        });
      });

      return results;
    });

    for (const card of extractedCards) {
      if (!jobsMap.has(card.id)) {
        jobsMap.set(card.id, card);
      }
    }

    if (jobsMap.size >= maxCards) {
      console.log(`🎯 Cap of ${maxCards} job cards reached.`);
      break;
    }

    if (jobsMap.size === initialCount) {
      attemptsWithoutNew++;
      console.log(`⏳ Scroll step produced no new cards (attempt ${attemptsWithoutNew}/${maxScrollAttempts}).`);
    } else {
      attemptsWithoutNew = 0;
      console.log(`📊 Found ${jobsMap.size} unique job cards so far...`);
    }

    // Scroll incremental action on result container
    await page.evaluate(() => {
      const container = document.querySelector(
        ".jobs-search-results-list, .scaffold-layout__list, div.jobs-search-results-list"
      );
      if (container) {
        container.scrollBy(0, 500);
      } else {
        window.scrollBy(0, 500);
      }
    });

    // Random delay for human-like pacing
    const delay = Math.floor(Math.random() * (scrollDelayMax - scrollDelayMin + 1)) + scrollDelayMin;
    await page.waitForTimeout(delay);
  }

  const finalCards = Array.from(jobsMap.values());
  console.log(`✅ Extracted ${finalCards.length} job cards from page.`);
  return finalCards;
}

module.exports = {
  buildSearchUrl,
  extractJobCards,
};
