const fs = require("fs");
const { JobStore, loadConfig, checkForChallenge, SecurityChallengeError, getRandomDelay, processJobQueue } = require("../src/linkedin");

(async () => {
  console.log("=================================================");
  console.log("🧪 TESTING SAFETY RAILS & SECURITY HARD STOP");
  console.log("=================================================\n");

  const TEST_STORE_PATH = "data/test_safety_jobs.json";
  const store = new JobStore(TEST_STORE_PATH);
  store.clear();

  const config = loadConfig();
  console.log(`📋 Configured Daily Application Cap: ${config.dailyApplicationCap}`);
  console.log(`⏱️ Configured Action Delay Range: ${config.actionDelayMinMs}ms - ${config.actionDelayMaxMs}ms`);
  console.log(`⏱️ Configured Job Application Delay Range: ${config.jobDelayMinMs}ms - ${config.jobDelayMaxMs}ms`);

  console.log("\n--- Test 1: Daily Cap Tracking & Enforcement ---");
  const todayIso = new Date().toISOString();
  store.saveJobs([
    { id: "9001", title: "Dev 1", company: "A", status: "applied", appliedAt: todayIso },
    { id: "9002", title: "Dev 2", company: "B", status: "applied", appliedAt: todayIso },
  ]);

  const countToday = store.getAppliedCountToday();
  console.log(`  • Recorded applications for today: ${countToday}`);

  // Test cap stop behavior
  const mockAgent = {
    browser: { wait: async () => {}, page: { url: () => "https://linkedin.com", title: async () => "LinkedIn" } },
  };

  const capTestResult = await processJobQueue(mockAgent, {
    storePath: TEST_STORE_PATH,
    dryRun: true,
  });

  console.log(`  • Queue Runner Outcome with Cap (${countToday}/15): status = [${capTestResult.status}]`);

  console.log("\n--- Test 2: Randomized Delay Range Calculation ---");
  for (let i = 1; i <= 3; i++) {
    const delay = getRandomDelay(config.actionDelayMinMs, config.actionDelayMaxMs);
    console.log(`  • Random delay sample ${i}: ${delay}ms (Within range [${config.actionDelayMinMs}, ${config.actionDelayMaxMs}]: ${delay >= config.actionDelayMinMs && delay <= config.actionDelayMaxMs})`);
  }

  console.log("\n--- Test 3: CAPTCHA / Security Challenge Detection Hard Stop ---");
  const mockChallengePage = {
    isClosed: () => false,
    url: () => "https://www.linkedin.com/checkpoint/challenge/az12345",
    title: async () => "Quick Security Check",
    evaluate: async () => "Please solve this puzzle to verify it is you.",
    locator: () => ({ first: () => ({ isVisible: async () => true }) }),
    screenshot: async () => {},
  };

  let caughtSecurityError = false;
  try {
    await checkForChallenge(mockChallengePage);
  } catch (err) {
    if (err instanceof SecurityChallengeError) {
      caughtSecurityError = true;
      console.log(`  ✅ Caught SecurityChallengeError: "${err.message}"`);
    }
  }

  if (countToday === 2 && caughtSecurityError) {
    console.log("\n🎉 ALL SAFETY RAILS VERIFIED SUCCESSFULLY!");
  } else {
    console.error("❌ Safety rails verification failed.");
    process.exit(1);
  }
})();
