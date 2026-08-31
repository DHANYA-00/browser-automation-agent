const Browser = require("./browser/browser");
const Agent = require("./agent/agent");

(async () => {
  const browser = new Browser();

  try {
    await browser.launch();

    // Enable mock planner mode if API key is not supplied in environment
    const options = {
      plannerOptions: {
        mockMode: !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY,
      },
    };

    const agent = new Agent(browser, options);

    await agent.run("Search for OpenAI on Google and open the first result");
  } catch (error) {
    console.error("❌ Fatal Error:", error);
  } finally {
    await browser.close();
  }
})();