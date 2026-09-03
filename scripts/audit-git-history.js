const { execSync } = require("child_process");

(() => {
  console.log("=================================================");
  console.log("🔒 GIT HISTORY SECRET & CREDENTIAL AUDIT");
  console.log("=================================================\n");

  // 1. Audit tracked and previously tracked sensitive files
  console.log("--- 1. Checking Sensitive File History ---");
  const sensitiveFiles = [
    ".env",
    ".env.local",
    "data/session.json",
    "session.json",
    "config.json",
    "config/default.json",
    "data/jobs.json",
  ];

  const fileAuditResults = [];

  for (const file of sensitiveFiles) {
    try {
      const history = execSync(`git log --all --full-history --oneline -- "${file}"`, {
        encoding: "utf-8",
      }).trim();

      if (history) {
        fileAuditResults.push({ file, status: "FOUND IN HISTORY", commits: history.split("\n") });
      } else {
        fileAuditResults.push({ file, status: "CLEAN (Never committed)", commits: [] });
      }
    } catch (err) {
      fileAuditResults.push({ file, status: "ERROR / NOT FOUND", error: err.message });
    }
  }

  console.log(JSON.stringify(fileAuditResults, null, 2));

  // 2. Search commit diffs for secret patterns
  console.log("\n--- 2. Searching Commit Diffs for Secret Patterns ---");
  const patterns = [
    "LINKEDIN_PASSWORD",
    "LINKEDIN_EMAIL",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "sk-",
    "sk-ant-",
    "Bearer ",
    "session",
    "cookie",
    "li_at",
  ];

  try {
    const gitLogDiffs = execSync("git log -p --all", { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });

    const findings = [];
    const lines = gitLogDiffs.split("\n");
    let currentCommit = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("commit ")) {
        currentCommit = line.substring(7, 15);
      }

      for (const pattern of patterns) {
        if (line.toLowerCase().includes(pattern.toLowerCase()) && (line.startsWith("+") || line.startsWith("-"))) {
          findings.push({
            commit: currentCommit,
            pattern,
            snippet: line.substring(0, 120),
          });
        }
      }
    }

    console.log(`Found ${findings.length} diff pattern matches.`);
    console.log("Sample Findings (first 25):");
    console.log(JSON.stringify(findings.slice(0, 25), null, 2));
  } catch (err) {
    console.error("Error searching git diffs:", err.message);
  }

  // 3. Check Remote Repository Visibility
  console.log("\n--- 3. Checking Remote Repo Visibility ---");
  try {
    const remoteUrl = execSync("git remote get-url origin", { encoding: "utf-8" }).trim();
    console.log(`Remote URL: ${remoteUrl}`);

    try {
      const ghView = execSync("gh repo view --json visibility,isPrivate", { encoding: "utf-8" }).trim();
      console.log(`GitHub CLI Repo Visibility info: ${ghView}`);
    } catch (ghErr) {
      console.log(`GitHub CLI info not available or gh tool not logged in: ${ghErr.message.split("\n")[0]}`);
    }
  } catch (err) {
    console.log("No git remote configured or error reading remote URL.");
  }
})();
