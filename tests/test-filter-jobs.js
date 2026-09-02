const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JobStore } = require("../src/linkedin");

(async () => {
  console.log("=================================================");
  console.log("🧪 LINKEDIN JOB FILTERING & PERSISTENCE TEST RUN");
  console.log("=================================================\n");

  const CONFIG_PATH = path.join(__dirname, "../config/default.json");
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));

  console.log("📋 Loaded filter configuration:");
  console.log(JSON.stringify(config, null, 2));

  const TEST_STORE_FILE = path.join(__dirname, "test_filtered_jobs.json");
  if (fs.existsSync(TEST_STORE_FILE)) fs.unlinkSync(TEST_STORE_FILE);

  const store = new JobStore(TEST_STORE_FILE);

  // Diverse test dataset covering all rules and edge cases
  const initialJobs = [
    {
      id: "JOB_101",
      title: "Software Engineer - Node.js",
      company: "TechCorp Inc",
      location: "Remote, US",
      postedDate: "2 days ago",
      easyApply: true,
      status: "NEW",
    },
    {
      id: "JOB_102",
      title: "Senior Full Stack Developer", // Should be filtered by excludeKeyword:Senior
      company: "Acme Cloud",
      location: "San Francisco, CA",
      postedDate: "1 day ago",
      easyApply: true,
      status: "NEW",
    },
    {
      id: "JOB_103",
      title: "Backend Engineer", // Should be filtered by companyBlacklist:CyberCoders
      company: "CyberCoders Staffing",
      location: "Austin, TX",
      postedDate: "3 days ago",
      easyApply: true,
      status: "NEW",
    },
    {
      id: "JOB_104",
      title: "Frontend Developer", // Should be filtered by easyApplyOnly
      company: "Digital Dynamics",
      location: "New York, NY",
      postedDate: "5 hours ago",
      easyApply: false,
      status: "NEW",
    },
    {
      id: "JOB_105",
      title: "Database Specialist", // Should be filtered by missingIncludeKeyword
      company: "DataWorks",
      location: "Chicago, IL",
      postedDate: "1 day ago",
      easyApply: true,
      status: "NEW",
    },
    {
      id: "JOB_106",
      title: "Software Developer", // Should be filtered by staleListing:14d
      company: "Legacy Systems",
      location: "Boston, MA",
      postedDate: "14 days ago",
      easyApply: true,
      status: "NEW",
    },
    {
      id: "JOB_107",
      title: "Senior Node.js Lead", // Protected job: already applied in previous run
      company: "Enterprise Ltd",
      location: "Remote",
      postedDate: "1 day ago",
      easyApply: true,
      status: "applied",
      reason: null,
    },
    {
      id: "JOB_108",
      title: "CyberCoders Staffing Engineer", // Protected job: flagged for review
      company: "CyberCoders",
      location: "Remote",
      postedDate: "1 day ago",
      easyApply: true,
      status: "flagged_for_review",
      reason: "manual_check_needed",
    },
  ];

  console.log(`\n💾 Seeding store with ${initialJobs.length} jobs...`);
  store.saveJobs(initialJobs);

  console.log("\n--- Executing applyFiltersAndSave() ---");
  const filterResults = store.applyFiltersAndSave(config);

  // Assertions
  console.log("🔍 Verifying filter expectations and rule assertions...");

  assert.strictEqual(filterResults.queued.length, 1, "Job 101 should be the only queued job");
  assert.strictEqual(filterResults.queued[0].id, "JOB_101");
  assert.strictEqual(filterResults.queued[0].status, "queued");
  assert.strictEqual(filterResults.queued[0].reason, null);

  assert.strictEqual(filterResults.filteredOut.length, 5, "5 jobs should be filtered out");

  const filteredMap = new Map(filterResults.filteredOut.map((j) => [j.id, j]));

  // Check specific reasons
  assert.strictEqual(filteredMap.get("JOB_102").reason, "excludeKeyword:Senior");
  assert.strictEqual(filteredMap.get("JOB_103").reason, "companyBlacklist:CyberCoders");
  assert.strictEqual(filteredMap.get("JOB_104").reason, "easyApplyOnly");
  assert.strictEqual(filteredMap.get("JOB_105").reason, "missingIncludeKeyword");
  assert.strictEqual(filteredMap.get("JOB_106").reason, "staleListing:14d");

  // Check protected jobs remain untouched
  assert.strictEqual(filterResults.skipped.length, 2, "2 jobs should be skipped as protected");
  const storedJob107 = store.getJobById("JOB_107");
  assert.strictEqual(storedJob107.status, "applied", "JOB_107 status must remain 'applied'");
  const storedJob108 = store.getJobById("JOB_108");
  assert.strictEqual(storedJob108.status, "flagged_for_review", "JOB_108 status must remain 'flagged_for_review'");

  console.log("✅ ALL FILTER ASSERTIONS PASSED PERFECTLY!");

  // Cleanup test file
  if (fs.existsSync(TEST_STORE_FILE)) fs.unlinkSync(TEST_STORE_FILE);
})();
