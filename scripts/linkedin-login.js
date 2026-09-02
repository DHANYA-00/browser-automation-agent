// MANUALLY EXECUTED DEV UTILITY SCRIPT (Not run in automated CI)
// Usage: node scripts/linkedin-login.js

const Browser = require("../src/browser/browser");
const Agent = require("../src/agent/agent");

(async () => {
  console.log("=================================================");
  console.log("🔒 LINKEDIN SESSION PERSISTENCE DEMO");
  console.log("=================================================\n");

  const SESSION_PATH = "data/session.json";

  // --- RUN 1: Initialize Browser and Authentication ---
  console.log("--- RUN 1: Check/Authenticate LinkedIn Session ---");
  const browser1 = new Browser();
  try {
    await browser1.launch();
    const authenticated = await browser1.loginLinkedIn(SESSION_PATH);

    if (authenticated) {
      console.log("✨ Run 1 Status: Successfully authenticated and session state saved.");
    } else {
      console.error("❌ Run 1 Status: Authentication failed.");
    }
  } catch (err) {
    console.error("❌ Run 1 Error:", err.message);
  } finally {
    await browser1.close();
  }

  // --- RUN 2: Subsequent Launch (Reusing Saved Session) ---
  console.log("\n-------------------------------------------------");
  console.log("--- RUN 2: Re-launching with Saved Session ---");
  console.log("-------------------------------------------------\n");

  const browser2 = new Browser();
  try {
    await browser2.launch();

    // Verify session loading and instant authentication
    const authenticated = await browser2.loginLinkedIn(SESSION_PATH);

    if (authenticated) {
      console.log("🎉 Run 2 Status: Session reused successfully! Skipped login page.");

      // Run agent task on authenticated LinkedIn context
      const agent = new Agent(browser2, {
        plannerOptions: {
          mockMode: !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY,
        },
      });

      console.log("\n🤖 Running Agent task on authenticated feed...");
      await agent.run("Search for software engineer jobs on LinkedIn");
    } else {
      console.error("❌ Run 2 Status: Session reuse failed.");
    }
  } catch (err) {
    console.error("❌ Run 2 Error:", err.message);
  } finally {
    await browser2.close();
  }
})();
