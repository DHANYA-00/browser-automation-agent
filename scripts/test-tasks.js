const Browser = require("../src/browser/browser");
const Agent = require("../src/agent/agent");

const TASKS = [
  "search for OpenAI on Google and open the first result",
  "go to Wikipedia and find the article on Playwright (software)",
  "go to Wikipedia, search for Node.js, and scroll down to the History section",
  "go to news.ycombinator.com and open the top story",
];

(async () => {
  console.log("=================================================");
  console.log("🧪 STARTING BROWSER AGENT SUITE (4 TASKS)");
  console.log("=================================================\n");

  const results = [];

  const useMock = !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY;
  if (useMock) {
    console.log(
      "ℹ️  No OPENAI_API_KEY or ANTHROPIC_API_KEY found. Running planner in intelligent fallback mode.\n"
    );
  }

  for (let i = 0; i < TASKS.length; i++) {
    const task = TASKS[i];
    console.log(`\n=================================================`);
    console.log(`▶️ RUNNING TASK ${i + 1}/${TASKS.length}: "${task}"`);
    console.log(`=================================================`);

    const browser = new Browser();

    try {
      await browser.launch();

      const agent = new Agent(browser, {
        maxSteps: 15,
        maxConsecutiveFailures: 3,
        plannerOptions: {
          mockMode: useMock,
        },
      });

      const outcome = await agent.run(task);

      results.push({
        task: outcome.task,
        stepsTaken: outcome.stepsTaken,
        retries: outcome.retries,
        status: outcome.status,
        reason: outcome.reason,
      });
    } catch (err) {
      console.error(`❌ Task ${i + 1} fatal exception:`, err.message);
      results.push({
        task,
        stepsTaken: 0,
        retries: 0,
        status: "gave-up-after-failures",
        reason: `Fatal error: ${err.message}`,
      });
    } finally {
      await browser.close();
    }
  }

  console.log("\n\n=================================================");
  console.log("📊 FINAL AGENT EVALUATION SUMMARY");
  console.log("=================================================\n");

  console.table(
    results.map((r, idx) => ({
      "#": idx + 1,
      Task: r.task.length > 45 ? r.task.substring(0, 42) + "..." : r.task,
      "Steps Taken": r.stepsTaken,
      "Retries (Failures)": r.retries,
      Outcome: r.status,
      Reason: r.reason.length > 50 ? r.reason.substring(0, 47) + "..." : r.reason,
    }))
  );
})();
