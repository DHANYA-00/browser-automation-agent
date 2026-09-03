const path = require("path");
const { JobStore } = require("../src/linkedin");

/**
 * CLI Tool for reviewing and resolving flagged jobs in the Easy Apply queue.
 *
 * Usage:
 *   node scripts/review-queue.js list           (or node scripts/review-queue.js)
 *   node scripts/review-queue.js resolve <jobId>
 */

function printUsage() {
  console.log(`
📋 LINKEDIN REVIEW QUEUE CLI

Usage:
  node scripts/review-queue.js list             Show all jobs flagged for review
  node scripts/review-queue.js resolve <jobId>  Resolve a job and re-queue it for application
`);
}

function listFlaggedJobs(store) {
  const flagged = store.getFlaggedJobs();

  console.log("\n=================================================");
  console.log(`📋 LINKEDIN REVIEW QUEUE (${flagged.length} flagged)`);
  console.log("=================================================\n");

  if (flagged.length === 0) {
    console.log("✨ Review queue is empty! No jobs currently flagged for review.");
    console.log("=================================================\n");
    return;
  }

  flagged.forEach((job, index) => {
    const timestamp = job.flaggedAt || job.updatedAt || job.foundAt || "Unknown date";
    const jobUrl = job.url || `https://www.linkedin.com/jobs/view/${job.id}/`;

    console.log(`[${index + 1}] 📌 Job ID: ${job.id}`);
    console.log(`    Title:   ${job.title || "N/A"}`);
    console.log(`    Company: ${job.company || "N/A"}`);
    console.log(`    Flagged: ${timestamp}`);
    console.log(`    Reason:  ${job.reason || "Unspecified flag"}`);
    console.log(`    URL:     ${jobUrl}`);
    console.log("-------------------------------------------------");
  });

  console.log("\n👉 To resolve a flagged job and reset its status to 'queued':");
  console.log("   node scripts/review-queue.js resolve <jobId>\n");
}

function resolveJob(store, jobId) {
  if (!jobId) {
    console.error("❌ Error: Missing jobId argument.");
    console.log("Usage: node scripts/review-queue.js resolve <jobId>");
    process.exit(1);
  }

  const job = store.getJobById(jobId);
  if (!job) {
    console.error(`❌ Error: Job ID "${jobId}" not found in persistence storage.`);
    process.exit(1);
  }

  const success = store.updateJobStatus(jobId, "queued", "Resolved from review queue");

  if (success) {
    console.log("\n=================================================");
    console.log("✅ JOB RESOLVED & REQUEUED SUCCESSFULLY");
    console.log("=================================================");
    console.log(`📌 Job ID:  ${job.id}`);
    console.log(`💼 Title:   ${job.title}`);
    console.log(`🏢 Company: ${job.company}`);
    console.log("🔄 Status:  queued (will be retried on next Easy Apply run)");
    console.log("=================================================\n");
  } else {
    console.error(`❌ Failed to update job status for ID ${jobId}.`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const command = (args[0] || "list").toLowerCase();

  // Allow custom store file path via environment or argument
  const storePath = process.env.JOB_STORE_PATH || "data/jobs.json";
  const store = new JobStore(storePath);

  switch (command) {
    case "list":
    case "ls":
      listFlaggedJobs(store);
      break;

    case "resolve":
      resolveJob(store, args[1]);
      break;

    case "help":
    case "-h":
    case "--help":
      printUsage();
      break;

    default:
      console.error(`❌ Unknown command: "${command}"`);
      printUsage();
      process.exit(1);
  }
}

main();
