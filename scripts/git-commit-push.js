const { execSync } = require("child_process");

(() => {
  console.log("=================================================");
  console.log("🛠️ GIT STAGING, COMMIT, AND PUSH SCRIPT");
  console.log("=================================================\n");

  const cwd = process.cwd();

  console.log("--- Step 1: Staging Files ---");
  execSync("git add .gitignore data/.gitkeep config/ docs/ tests/ scripts/ src/ README.md", { cwd, stdio: "inherit" });

  console.log("\n--- Step 2: Committing Changes ---");
  const commitMsg = "fix: track config, docs, and tests; keep only secrets/data ignored";
  try {
    execSync(`git commit -m "${commitMsg}"`, { cwd, stdio: "inherit" });
  } catch (err) {
    console.log("Nothing new to commit or commit completed.");
  }

  console.log("\n--- Step 3: Verifying Tracked Files (git ls-files) ---");
  const trackedFiles = execSync("git ls-files | grep -E '^(config|docs|tests)/'", { cwd, encoding: "utf-8" });
  console.log(trackedFiles);

  console.log("--- Step 4: Pushing to Remote Branch ---");
  execSync("git push origin browser", { cwd, stdio: "inherit" });

  console.log("\n--- Step 5: Recent Commit Log (git log --oneline -3) ---");
  const recentLog = execSync("git log --oneline -3", { cwd, encoding: "utf-8" });
  console.log(recentLog);

  console.log("=================================================");
  console.log("✅ GIT REPOSITORY FIX COMPLETED & PUSHED SUCCESSFULLY");
  console.log("=================================================");
})();
