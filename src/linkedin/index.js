const { buildSearchUrl, extractJobCards } = require("./jobSearch");
const { applyFilters, printFilterSummary, parsePostedDaysAgo } = require("./filterJobs");
const JobStore = require("./persistence");
const { applyToJob, checkModalScreeningQuestions, dismissModal } = require("./easyApply");
const { checkForChallenge, SecurityChallengeError, getRandomDelay } = require("./safety");
const { processJobQueue } = require("./queueRunner");
const { loadConfig } = require("../../config");

/**
 * High-level production pipeline function:
 * 1. Loads config/default.json (throws if missing/invalid)
 * 2. Extracts job cards from Playwright page
 * 3. Saves raw extracted jobs to JobStore
 * 4. Applies config filter rules and persists updated statuses
 *
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {Object} [options]
 * @param {string} [options.storePath="data/jobs.json"] - Path to storage JSON
 * @param {string} [options.configPath] - Custom config path
 * @param {number} [options.maxCards=50] - Max job cards to extract
 * @returns {Promise<{ rawJobs: Array, saveResult: Object, filterResults: Object }>}
 */
async function searchAndFilterJobs(page, options = {}) {
  const { storePath = "data/jobs.json", configPath, maxCards = 50 } = options;

  // 1. Load config (throws clear error if missing/invalid)
  const config = loadConfig(configPath);
  console.log("📋 Loaded filter configuration for pipeline execution.");

  // 2. Check for security challenges
  await checkForChallenge(page);

  // Extract job cards from current page
  const rawJobs = await extractJobCards(page, { maxCards });

  // Save raw jobs to store
  const store = new JobStore(storePath);
  const saveResult = store.saveJobs(rawJobs);
  console.log(`💾 Persisted ${saveResult.newCount} new jobs (Total: ${saveResult.totalCount}).`);

  // Apply filter rules and save updated statuses
  console.log("⚙️ Applying deterministic filter rules...");
  const filterResults = store.applyFiltersAndSave(config);

  return {
    rawJobs,
    saveResult,
    filterResults,
  };
}

module.exports = {
  buildSearchUrl,
  extractJobCards,
  applyFilters,
  printFilterSummary,
  parsePostedDaysAgo,
  JobStore,
  loadConfig,
  searchAndFilterJobs,
  applyToJob,
  checkModalScreeningQuestions,
  dismissModal,
  checkForChallenge,
  SecurityChallengeError,
  getRandomDelay,
  processJobQueue,
};
