const Browser = require("./browser/browser");
const Agent = require("./agent/agent");

(async () => {
  const browser = new Browser();

  try {
    await browser.launch();

    // Ensure authenticated session on LinkedIn before executing agent tasks
    const authenticated = await browser.loginLinkedIn("data/session.json");

    if (authenticated) {
      const options = {
        plannerOptions: {
          mockMode: !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY,
        },
      };

      const agent = new Agent(browser, options);
      await agent.run("Search for software engineer jobs on LinkedIn");
    }
  } catch (error) {
    console.error("❌ Fatal Error:", error);
  } finally {
    await browser.close();
  }
})();