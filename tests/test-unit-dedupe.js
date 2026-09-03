const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { buildSearchUrl, JobStore } = require("../src/linkedin");

console.log("=================================================");
console.log("🧪 RUNNING UNIT & DEDUPE TESTS");
console.log("=================================================\n");

// --- TEST 1: buildSearchUrl ---
console.log("Test 1: Testing buildSearchUrl construction...");
const url1 = buildSearchUrl({
  keywords: "Software Engineer",
  location: "United States",
  datePosted: "past_24h",
  easyApplyOnly: true,
});

assert.strictEqual(
  url1,
  "https://www.linkedin.com/jobs/search/?keywords=Software+Engineer&location=United+States&f_TPR=r86400&f_AL=true",
  "URL string must match expected format"
);
console.log("  ✅ Test 1 Passed: Generated URL correctly matches parameters.");

const url2 = buildSearchUrl({
  keywords: "Frontend Developer",
  datePosted: "week",
});
assert.strictEqual(
  url2,
  "https://www.linkedin.com/jobs/search/?keywords=Frontend+Developer&f_TPR=r604800",
  "URL string for week filter must match f_TPR=r604800"
);
console.log("  ✅ Test 1b Passed: Date posted week filter handled correctly.");

// --- TEST 2: Persistence & Dedupe Logic ---
console.log("\nTest 2: Testing JobStore persistence and deduplication...");
const TEST_FILE = path.join(__dirname, "temp_test_jobs.json");
if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);

const store = new JobStore(TEST_FILE);

const sampleBatch1 = [
  {
    id: "1001",
    title: "Senior Node.js Engineer",
    company: "Acme Corp",
    location: "Remote",
    postedDate: "1 day ago",
    easyApply: true,
  },
  {
    id: "1002",
    title: "Full Stack Engineer",
    company: "Beta Inc",
    location: "New York, NY",
    postedDate: "2 hours ago",
    easyApply: false,
  },
];

// First save
const run1 = store.saveJobs(sampleBatch1);
assert.strictEqual(run1.newCount, 2, "Run 1 must add 2 new jobs");
assert.strictEqual(run1.existingCount, 0, "Run 1 existing count must be 0");
assert.strictEqual(run1.totalCount, 2, "Run 1 total count must be 2");

// Verify schema fields
const saved1 = store.getJobById("1001");
assert.strictEqual(saved1.title, "Senior Node.js Engineer");
assert.strictEqual(saved1.status, "NEW");
assert.ok(saved1.foundAt, "foundAt timestamp must exist");

// Modify status of job 1001 to simulated custom status e.g. "APPLIED"
store.updateJobStatus("1001", "APPLIED");
assert.strictEqual(store.getJobById("1001").status, "APPLIED");

// Second save with overlapping and new jobs
const sampleBatch2 = [
  {
    id: "1001", // Duplicate
    title: "Senior Node.js Engineer",
    company: "Acme Corp",
    location: "Remote",
    postedDate: "1 day ago",
    easyApply: true,
  },
  {
    id: "1003", // New job
    title: "Backend Specialist",
    company: "Gamma LLC",
    location: "San Francisco, CA",
    postedDate: "3 hours ago",
    easyApply: true,
  },
];

const run2 = store.saveJobs(sampleBatch2);
assert.strictEqual(run2.newCount, 1, "Run 2 must add 1 new job (1003)");
assert.strictEqual(run2.existingCount, 1, "Run 2 must detect 1 existing duplicate (1001)");
assert.strictEqual(run2.totalCount, 3, "Total jobs stored must now be 3");

// Critical Check: Status of job 1001 must remain "APPLIED" (untouched!)
const updatedJob1001 = store.getJobById("1001");
assert.strictEqual(
  updatedJob1001.status,
  "APPLIED",
  "Status of existing job must remain untouched after deduplication"
);
console.log("  ✅ Test 2 Passed: Persistence & Deduplication working perfectly. Status untouched!");

// Cleanup temp test file
if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);

console.log("\n✨ ALL UNIT & DEDUPE TESTS PASSED SUCCESSFULLY!");
