const assert = require("assert");
const Browser = require("../src/browser/browser");
const Agent = require("../src/agent/agent");

(async () => {
  console.log("=================================================");
  console.log("🧪 TESTING ACTION RETRY & FAILURE RECOVERY LOGIC");
  console.log("=================================================\n");

  const browser = new Browser();

  try {
    await browser.launch();

    // Create an agent with a planner that forces a failing action to test recovery
    const agent = new Agent(browser, {
      maxSteps: 10,
      maxConsecutiveFailures: 3,
    });

    let attempts = 0;
    agent.planner.getNextAction = async (task, observation, history) => {
      attempts++;
      if (attempts === 1) {
        return { type: "NAVIGATE", url: "https://example.com" };
      }
      if (attempts === 2) {
        // Intentionally invalid selector to trigger action execution failure
        return { type: "CLICK", selector: "#non-existent-element-id-12345" };
      }
      return { type: "DONE", reason: "Recovered after failure and completed." };
    };

    const outcome = await agent.run("Test action retry recovery");

    console.log("\n📊 RETRY TEST OUTCOME:");
    console.log("Status:", outcome.status);
    console.log("Steps Taken:", outcome.stepsTaken);
    console.log("Retries (Failures):", outcome.retries);
    console.log("History items count:", outcome.history.length);
    console.log("Failed action recorded in history:", outcome.history.some(h => h.action.status === "failed"));

    // Automated assertions
    assert.strictEqual(outcome.status, "DONE", "Outcome status should be DONE after recovery");
    assert.strictEqual(outcome.retries, 1, "Should record 1 retry/failure");
    assert.strictEqual(outcome.history.some(h => h.action.status === "failed"), true, "Failed action must be recorded in history");
    console.log("✅ ACTION RETRY & FAILURE RECOVERY TEST PASSED PERFECTLY!");
  } catch (err) {
    console.error("❌ Test error:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
