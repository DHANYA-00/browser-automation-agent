const Observer = require("./observer");
const Memory = require("./memory");
const Planner = require("./planner");
const { executeAction } = require("../browser/actions");

class Agent {
  constructor(browser, options = {}) {
    this.browser = browser;
    this.maxSteps = options.maxSteps || 40;
    this.maxConsecutiveFailures = options.maxConsecutiveFailures || 3;

    this.observer = new Observer(browser);
    this.memory = new Memory();
    this.planner = new Planner(options.plannerOptions);
  }

  async run(task) {
    console.log("\n🤖 AI Browser Operator");
    console.log(`🎯 Task: ${task}\n`);

    this.memory.setTask(task);

    let stepCount = 0;
    let consecutiveFailures = 0;
    let totalFailures = 0;
    let finalStatus = "in-progress";
    let statusReason = "";

    while (stepCount < this.maxSteps) {
      stepCount++;
      console.log(`\n--- Step ${stepCount}/${this.maxSteps} ---`);

      // 1. Observe current page state
      const observation = await this.observer.observe();

      // 2. Get recent history for planner context (includes previous failures/retries)
      const history = this.memory.getRecentHistory(10);

      // 3. Obtain next single action from LLM planner
      let action;
      try {
        action = await this.planner.getNextAction(task, observation, history);
        console.log("🧠 Decided Action:", JSON.stringify(action));
      } catch (error) {
        console.error("❌ Planner Error:", error.message);
        finalStatus = "gave-up-after-failures";
        statusReason = `Planner error: ${error.message}`;
        this.memory.addHistory({
          type: "ERROR",
          status: "failed",
          failed: true,
          error: error.message,
        });
        break;
      }

      // 4. Handle DONE action
      if (action.type === "DONE") {
        statusReason = action.reason || "Goal achieved.";
        console.log(`\n🎉 Task Completed! Reason: ${statusReason}`);
        this.memory.addHistory({ ...action, status: "success" });
        finalStatus = "DONE";
        consecutiveFailures = 0;
        break;
      }

      // 5. Execute action with retry/recovery logic
      try {
        const isDone = await executeAction(this.browser, action);
        this.memory.addHistory({ ...action, status: "success" });
        consecutiveFailures = 0; // Reset consecutive failures on success

        if (isDone) {
          finalStatus = "DONE";
          statusReason = "Action signaled completion.";
          break;
        }
      } catch (error) {
        consecutiveFailures++;
        totalFailures++;
        console.warn(
          `⚠️ Action [${action.type}] failed (Consecutive Failure ${consecutiveFailures}/${this.maxConsecutiveFailures}): ${error.message}`
        );

        // Log failure to memory with failed flag and error message
        this.memory.addHistory({
          ...action,
          status: "failed",
          failed: true,
          error: error.message,
        });

        // Cap consecutive failures
        if (consecutiveFailures >= this.maxConsecutiveFailures) {
          statusReason = `Giving up after ${consecutiveFailures} consecutive action failures. Last error: ${error.message}`;
          console.error(`\n🛑 ${statusReason}`);
          finalStatus = "gave-up-after-failures";
          break;
        }

        // Re-run observer.observe() to refresh page state before letting the planner try again
        console.log("🔄 Re-evaluating page state for recovery attempt...");
        await this.observer.observe();
      }
    }

    if (finalStatus === "in-progress" && stepCount >= this.maxSteps) {
      statusReason = `Safety cap of ${this.maxSteps} steps reached without completing task.`;
      finalStatus = "step-limit-hit";
      console.log(`\n🛑 ${statusReason}`);
    }

    console.log(`\n✅ Agent finished execution with status: [${finalStatus}]`);

    const finalState = {
      task,
      stepsTaken: stepCount,
      retries: totalFailures,
      status: finalStatus,
      reason: statusReason,
      history: this.memory.getHistory(),
    };

    return finalState;
  }
}

module.exports = Agent;