/**
 * Config-driven Deterministic Job Filter Module
 */

/**
 * Helper to parse relative or ISO date string into days ago.
 * @param {string} postedDateStr 
 * @returns {number} Days ago
 */
function parsePostedDaysAgo(postedDateStr) {
  if (!postedDateStr || typeof postedDateStr !== "string") return 0;
  const str = postedDateStr.toLowerCase().trim();

  if (str.includes("minute") || str.includes("hour") || str.includes("just now") || str.includes("today")) {
    return 0;
  }
  if (str.includes("yesterday")) {
    return 1;
  }
  const dayMatch = str.match(/(\d+)\s*d/);
  if (dayMatch) {
    return parseInt(dayMatch[1], 10);
  }
  const weekMatch = str.match(/(\d+)\s*w/);
  if (weekMatch) {
    return parseInt(weekMatch[1], 10) * 7;
  }
  const monthMatch = str.match(/(\d+)\s*m/);
  if (monthMatch && !str.includes("minute")) {
    return parseInt(monthMatch[1], 10) * 30;
  }

  const parsedTime = Date.parse(postedDateStr);
  if (!isNaN(parsedTime)) {
    const diffMs = Date.now() - parsedTime;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  return 0;
}

/**
 * Applies deterministic filter rules to a list of jobs based on configuration.
 * Protected jobs (e.g. "applied", "flagged_for_review") are left untouched.
 *
 * @param {Array<Object>} jobs - List of job objects
 * @param {Object} config - Filter configuration options
 * @returns {Object} { queued: [], filteredOut: [], skipped: [] }
 */
function applyFilters(jobs = [], config = {}) {
  const {
    includeKeywords = [],
    excludeKeywords = [],
    companyBlacklist = [],
    easyApplyOnly = false,
    minPostedWithinDays = 0,
  } = config;

  const queued = [];
  const filteredOut = [];
  const skipped = [];

  // Status values that must remain untouched
  const PROTECTED_STATUSES = new Set(["applied", "flagged_for_review"]);

  for (const rawJob of jobs) {
    // Create a copy of the job object to prevent accidental mutation of original until saved
    const job = { ...rawJob };

    // Rule 1: Do not modify protected jobs from previous runs
    if (job.status && PROTECTED_STATUSES.has(job.status.toLowerCase())) {
      skipped.push(job);
      continue;
    }

    let filterReason = null;

    // Rule 2: Easy Apply Only check
    if (easyApplyOnly && !job.easyApply) {
      filterReason = "easyApplyOnly";
    }

    // Rule 3: Company Blacklist check
    if (!filterReason && Array.isArray(companyBlacklist) && companyBlacklist.length > 0) {
      const companyLower = (job.company || "").toLowerCase();
      for (const blacklisted of companyBlacklist) {
        if (blacklisted && companyLower.includes(blacklisted.toLowerCase())) {
          filterReason = `companyBlacklist:${blacklisted}`;
          break;
        }
      }
    }

    // Rule 4: Exclude Keywords check (Title & Description)
    if (!filterReason && Array.isArray(excludeKeywords) && excludeKeywords.length > 0) {
      const textToSearch = `${job.title || ""} ${job.description || ""}`.toLowerCase();
      for (const keyword of excludeKeywords) {
        if (!keyword) continue;
        const kwLower = keyword.toLowerCase();
        // Check exact word boundary if single word, or substring if multi-word phrase
        const regex = new RegExp(`\\b${kwLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (regex.test(textToSearch) || textToSearch.includes(kwLower)) {
          filterReason = `excludeKeyword:${keyword}`;
          break;
        }
      }
    }

    // Rule 5: Include Keywords check (at least one must match if list is non-empty)
    if (!filterReason && Array.isArray(includeKeywords) && includeKeywords.length > 0) {
      const textToSearch = `${job.title || ""} ${job.description || ""}`.toLowerCase();
      const hasMatch = includeKeywords.some((keyword) => {
        if (!keyword) return false;
        const kwLower = keyword.toLowerCase();
        return textToSearch.includes(kwLower);
      });

      if (!hasMatch) {
        filterReason = "missingIncludeKeyword";
      }
    }

    // Rule 6: Stale Listing check (minPostedWithinDays)
    if (!filterReason && typeof minPostedWithinDays === "number" && minPostedWithinDays > 0) {
      const ageDays = parsePostedDaysAgo(job.postedDate);
      if (ageDays > minPostedWithinDays) {
        filterReason = `staleListing:${ageDays}d`;
      }
    }

    // Apply outcome
    if (filterReason) {
      job.status = "filtered_out";
      job.reason = filterReason;
      filteredOut.push(job);
    } else {
      job.status = "queued";
      job.reason = null;
      queued.push(job);
    }
  }

  return { queued, filteredOut, skipped };
}

/**
 * Prints a clean CLI summary breakdown of job filtering results.
 *
 * @param {Object} results - Outcome from applyFilters
 */
function printFilterSummary(results = {}) {
  const queued = results.queued || [];
  const filteredOut = results.filteredOut || [];
  const skipped = results.skipped || [];

  const totalEvaluated = queued.length + filteredOut.length;
  const totalProcessed = totalEvaluated + skipped.length;

  console.log("\n=================================================");
  console.log("📊 JOB FILTERING SUMMARY");
  console.log("=================================================");
  console.log(` Total Scraped/Loaded:  ${totalProcessed}`);
  console.log(`  • Evaluated Jobs:     ${totalEvaluated}`);
  console.log(`  ✅ Queued for Apply:   ${queued.length}`);
  console.log(`  🚫 Filtered Out:       ${filteredOut.length}`);
  if (skipped.length > 0) {
    console.log(`  ⏩ Skipped (Protected): ${skipped.length}`);
  }

  if (filteredOut.length > 0) {
    console.log("\n Reason Breakdown:");
    const reasonCounts = {};
    for (const job of filteredOut) {
      const r = job.reason || "unknown";
      reasonCounts[r] = (reasonCounts[r] || 0) + 1;
    }
    for (const [reason, count] of Object.entries(reasonCounts)) {
      console.log(`   • ${reason.padEnd(28)}: ${count}`);
    }
  }
  console.log("=================================================\n");
}

module.exports = {
  applyFilters,
  printFilterSummary,
  parsePostedDaysAgo,
};
