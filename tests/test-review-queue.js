const { execSync } = require("child_process");
const { JobStore } = require("../src/linkedin");

(() => {
  console.log("=================================================");
  console.log("🧪 TESTING REVIEW QUEUE CLI (LIST & RESOLVE)");
  console.log("=================================================\n");

  const TEST_STORE_PATH = "data/test_review_queue_jobs.json";
  const store = new JobStore(TEST_STORE_PATH);
  store.clear();

  console.log("--- Step 1: Check Empty Review Queue ---");
  const emptyOutput = execSync(`JOB_STORE_PATH="${TEST_STORE_PATH}" node scripts/review-queue.js list`, {
    encoding: "utf-8",
  });
  console.log(emptyOutput);

  console.log("--- Step 2: Seed Storage with Flagged Jobs ---");
  store.saveJobs([
    {
      id: "7001",
      title: "Senior Backend Developer",
      company: "CloudScale Inc",
      location: "Remote",
      postedDate: "1d ago",
      easyApply: true,
      status: "NEW",
    },
    {
      id: "7002",
      title: "Frontend Architect",
      company: "InnovateTech",
      location: "San Jose, CA",
      postedDate: "2d ago",
      easyApply: true,
      status: "NEW",
    },
  ]);

  // Flag job 7001 due to unrecognized question
  store.updateJobStatus(
    "7001",
    "flagged_for_review",
    'Unrecognized screening question: "Do you have AWS Certified Solutions Architect certification?"'
  );

  // Flag job 7002 due to max steps
  store.updateJobStatus(
    "7002",
    "flagged_for_review",
    "Exceeded MAX_STEPS cap (15 steps)"
  );

  console.log("--- Step 3: Run 'review-queue.js list' CLI ---");
  const listOutput = execSync(`JOB_STORE_PATH="${TEST_STORE_PATH}" node scripts/review-queue.js list`, {
    encoding: "utf-8",
  });
  console.log(listOutput);

  console.log("--- Step 4: Resolve Job 7001 via CLI ---");
  const resolveOutput = execSync(`JOB_STORE_PATH="${TEST_STORE_PATH}" node scripts/review-queue.js resolve 7001`, {
    encoding: "utf-8",
  });
  console.log(resolveOutput);

  console.log("--- Step 5: Verify Review Queue after Resolution ---");
  const finalListOutput = execSync(`JOB_STORE_PATH="${TEST_STORE_PATH}" node scripts/review-queue.js list`, {
    encoding: "utf-8",
  });
  console.log(finalListOutput);

  const updatedJob7001 = store.getJobById("7001");
  const remainingFlagged = store.getFlaggedJobs();

  if (updatedJob7001.status === "queued" && remainingFlagged.length === 1 && remainingFlagged[0].id === "7002") {
    console.log("🎉 REVIEW QUEUE CLI TESTS PASSED PERFECTLY!");
  } else {
    console.error("❌ Review queue CLI test failed.");
    process.exit(1);
  }
})();
