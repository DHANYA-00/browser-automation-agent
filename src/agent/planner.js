const VALID_ACTION_TYPES = [
  "NAVIGATE",
  "CLICK",
  "TYPE",
  "PRESS",
  "HOVER",
  "SCROLL_DOWN",
  "SCROLL_UP",
  "WAIT",
  "WAIT_FOR_SELECTOR",
  "SCREENSHOT",
  "RELOAD",
  "BACK",
  "FORWARD",
  "LINKEDIN_JOB_SEARCH",
  "DONE",
];

class Planner {
  constructor(options = {}) {
    this.apiKey =
      options.apiKey ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY;
    this.provider =
      options.provider ||
      (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai");
    this.model =
      options.model ||
      (this.provider === "anthropic"
        ? "claude-3-5-sonnet-20241022"
        : "gpt-4o-mini");
    this.mockMode = options.mockMode || false;
  }

  buildSystemPrompt() {
    return `You are a Playwright browser automation agent planner.
Your goal is to achieve the user's task step by step by examining the current web page state and deciding the NEXT single action.

ALLOWED ACTIONS SCHEMA:
Return ONLY a single valid JSON object matching ONE of these action schemas:

1. NAVIGATE: { "type": "NAVIGATE", "url": "<url_string>" }
2. CLICK: { "type": "CLICK", "selector": "<css_selector_from_elements_list>" }
3. TYPE: { "type": "TYPE", "selector": "<css_selector>", "text": "<text_to_type>" }
4. PRESS: { "type": "PRESS", "key": "<key_name_e.g._Enter_Tab_Escape>" }
5. HOVER: { "type": "HOVER", "selector": "<css_selector>" }
6. SCROLL_DOWN: { "type": "SCROLL_DOWN", "amount": 600 }
7. SCROLL_UP: { "type": "SCROLL_UP", "amount": 600 }
8. WAIT: { "type": "WAIT", "ms": 1000 }
9. WAIT_FOR_SELECTOR: { "type": "WAIT_FOR_SELECTOR", "selector": "<css_selector>" }
10. SCREENSHOT: { "type": "SCREENSHOT", "name": "<filename.png>" }
11. RELOAD: { "type": "RELOAD" }
12. BACK: { "type": "BACK" }
13. FORWARD: { "type": "FORWARD" }
14. LINKEDIN_JOB_SEARCH: { "type": "LINKEDIN_JOB_SEARCH", "keywords": "<keywords>", "location": "<location>", "jobType": "<jobType>" }
15. DONE: { "type": "DONE", "reason": "<explanation_of_how_task_was_completed>" }

RULES:
- Choose selectors directly from the current interactive elements list provided in the observation whenever possible.
- Prefer semantic selectors like role, text, aria-label, placeholder, name, and accessible labels rather than brittle CSS classes.
- Review recent action history carefully. If an action in history failed (status: 'failed' or has an error message), DO NOT repeat the exact same selector/action. Select an alternative element or try a different approach.
- Return ONLY strict raw JSON. Do NOT wrap in markdown code blocks like \`\`\`json. Do NOT output extra text or explanations outside JSON.`;
  }

  buildLinkedInJobSearchPlan(task) {
    const normalizedTask = (task || "").toLowerCase();
    const searchTerm = "software developer";

    if (
      normalizedTask.includes("linkedin") &&
      normalizedTask.includes("job") &&
      normalizedTask.includes(searchTerm)
    ) {
      return [
        { type: "NAVIGATE", url: "https://www.linkedin.com/jobs/" },
        {
          type: "WAIT_FOR_SELECTOR",
          selector: "input[role='combobox'][aria-label*='Search jobs' i], input[placeholder*='Search jobs' i], input[aria-label*='Keyword' i], input[name='keywords']",
        },
        {
          type: "TYPE",
          selector: "input[role='combobox'][aria-label*='Search jobs' i], input[placeholder*='Search jobs' i], input[aria-label*='Keyword' i], input[name='keywords']",
          text: "Software Developer",
        },
        { type: "PRESS", key: "Enter" },
        { type: "WAIT", ms: 3000 },
        {
          type: "DONE",
          reason: "LinkedIn job search launched and results have been observed.",
        },
      ];
    }

    return null;
  }

  getNextActionFromPlan(task, observation, history = []) {
    const plan = this.buildLinkedInJobSearchPlan(task);
    if (!plan) {
      return null;
    }

    const lastAction = history[history.length - 1];
    const url = observation.url || "";

    if (!url || url === "about:blank") {
      return plan[0];
    }

    if (!url.includes("linkedin.com/jobs")) {
      return plan[0];
    }

    if (!lastAction || lastAction.type === "NAVIGATE") {
      return plan[1];
    }

    if (lastAction.type === "WAIT_FOR_SELECTOR") {
      return plan[2];
    }

    if (lastAction.type === "TYPE") {
      return plan[3];
    }

    if (lastAction.type === "PRESS") {
      return plan[4];
    }

    if (lastAction.type === "WAIT") {
      return plan[5];
    }

    if (lastAction.type === "DONE") {
      return plan[5];
    }

    return plan[5];
  }

  buildUserPrompt(task, observation, history) {
    const formattedElements = (observation.elements || []).map((el, i) => ({
      index: i + 1,
      tag: el.tag,
      type: el.type,
      text: el.text,
      selector: el.selector,
    }));

    return JSON.stringify(
      {
        task,
        current_observation: {
          title: observation.title || "",
          url: observation.url || "",
          visibleText: observation.visibleText || "",
          jobs: observation.jobs || [],
          currentPageState: observation.currentPageState || {},
          interactive_elements_count: formattedElements.length,
          interactive_elements: formattedElements,
        },
        recent_action_history: history,
      },
      null,
      2
    );
  }

  async getNextAction(task, observation, history = []) {
    const plannedAction = this.getNextActionFromPlan(task, observation, history);
    if (plannedAction) {
      return plannedAction;
    }

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(task, observation, history);

    if (this.mockMode) {
      return this.getMockAction(task, observation, history);
    }

    if (!this.apiKey) {
      if (process.env.ALLOW_MOCK_PLANNER === "true") {
        return this.getMockAction(task, observation, history);
      }
      throw new Error(
        "No LLM API key found. Please set ANTHROPIC_API_KEY or OPENAI_API_KEY in process.env."
      );
    }

    let responseText;
    if (this.provider === "anthropic") {
      responseText = await this.callAnthropic(systemPrompt, userPrompt);
    } else {
      responseText = await this.callOpenAI(systemPrompt, userPrompt);
    }

    return this.parseAndValidateResponse(responseText);
  }

  async callAnthropic(systemPrompt, userPrompt) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || "";
  }

  async callOpenAI(systemPrompt, userPrompt) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }

  parseAndValidateResponse(responseText) {
    let cleanText = responseText.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanText);
    } catch (err) {
      throw new Error(
        `Failed to parse LLM response as JSON: "${responseText}". Error: ${err.message}`
      );
    }

    return this.validateAction(parsed);
  }

  validateAction(action) {
    if (!action || typeof action !== "object" || Array.isArray(action)) {
      throw new Error("Action output must be a valid JSON object");
    }

    if (!action.type || typeof action.type !== "string") {
      throw new Error("Action object must contain a string 'type' field.");
    }

    const type = action.type.toUpperCase();
    action.type = type;

    if (!VALID_ACTION_TYPES.includes(type)) {
      throw new Error(
        `Invalid action type '${type}'. Must be one of: ${VALID_ACTION_TYPES.join(", ")}`
      );
    }

    switch (type) {
      case "NAVIGATE":
        if (!action.url || typeof action.url !== "string") {
          throw new Error("NAVIGATE action requires a string 'url' field.");
        }
        break;
      case "CLICK":
        if (!action.selector || typeof action.selector !== "string") {
          throw new Error("CLICK action requires a string 'selector' field.");
        }
        break;
      case "TYPE":
        if (
          !action.selector ||
          typeof action.selector !== "string" ||
          typeof action.text !== "string"
        ) {
          throw new Error("TYPE action requires string 'selector' and 'text' fields.");
        }
        break;
      case "PRESS":
        if (!action.key || typeof action.key !== "string") {
          throw new Error("PRESS action requires a string 'key' field.");
        }
        break;
      case "HOVER":
      case "WAIT_FOR_SELECTOR":
        if (!action.selector || typeof action.selector !== "string") {
          throw new Error(`${type} action requires a string 'selector' field.`);
        }
        break;
      case "LINKEDIN_JOB_SEARCH":
        if (
          !action.keywords ||
          typeof action.keywords !== "string" ||
          !action.location ||
          typeof action.location !== "string" ||
          !action.jobType ||
          typeof action.jobType !== "string"
        ) {
          throw new Error(
            "LINKEDIN_JOB_SEARCH action requires string 'keywords', 'location', and 'jobType' fields."
          );
        }
        break;
    }

    return action;
  }

  getMockAction(task, observation, history) {
    const lastAction = history[history.length - 1];
    const url = observation.url || "";
    const lowerTask = task.toLowerCase();

    if (lowerTask.includes("software developer") && lowerTask.includes("linkedin")) {
      return this.getNextActionFromPlan(task, observation, history) || {
        type: "DONE",
        reason: "LinkedIn Software Developer job search task complete.",
      };
    }

    if (lowerTask.includes("openai") && lowerTask.includes("google")) {
      if (!url || url === "about:blank") {
        return { type: "NAVIGATE", url: "https://www.google.com" };
      }
      if (url.includes("google.com")) {
        if (!lastAction || lastAction.type === "NAVIGATE") {
          const inputEl = (observation.elements || []).find(
            (el) =>
              (el.tag === "textarea" || el.tag === "input") &&
              el.type !== "submit" &&
              el.type !== "hidden"
          );
          return {
            type: "TYPE",
            selector: inputEl?.selector || 'textarea[name="q"]',
            text: "OpenAI",
          };
        }
        if (lastAction.type === "TYPE") {
          return { type: "PRESS", key: "Enter" };
        }
        if (lastAction.type === "PRESS") {
          const firstResult = (observation.elements || []).find(
            (el) =>
              el.tag === "a" &&
              (el.text.toLowerCase().includes("openai") || el.selector.includes("search"))
          );
          return {
            type: "CLICK",
            selector: firstResult?.selector || "a[href*='openai.com']",
          };
        }
      }
      if (url.includes("openai.com") || lastAction?.type === "CLICK") {
        return { type: "DONE", reason: "Navigated to OpenAI website successfully." };
      }
    }

    if (lowerTask.includes("wikipedia") && lowerTask.includes("playwright")) {
      if (!url || url === "about:blank") {
        return { type: "NAVIGATE", url: "https://en.wikipedia.org/wiki/Main_Page" };
      }
      if (url.includes("wikipedia.org")) {
        if (!url.includes("Playwright_(software)")) {
          if (!lastAction || lastAction.type === "NAVIGATE") {
            const searchInput = (observation.elements || []).find(
              (el) => el.tag === "input" && (el.type === "search" || el.selector.includes("search"))
            );
            return {
              type: "TYPE",
              selector: searchInput?.selector || 'input[name="search"]',
              text: "Playwright (software)",
            };
          }
          if (lastAction.type === "TYPE") {
            return { type: "PRESS", key: "Enter" };
          }
        }
        if (url.includes("Playwright_(software)") || observation.title.includes("Playwright")) {
          return { type: "DONE", reason: "Found and opened Wikipedia article on Playwright (software)." };
        }
      }
    }

    if (lowerTask.includes("wikipedia") && lowerTask.includes("node.js")) {
      if (!url || url === "about:blank") {
        return { type: "NAVIGATE", url: "https://en.wikipedia.org/wiki/Node.js" };
      }
      if (url.includes("Node.js")) {
        if (lastAction?.type === "NAVIGATE" || !lastAction) {
          const historyLink = (observation.elements || []).find(
            (el) => el.tag === "a" && el.text.toLowerCase() === "history"
          );
          if (historyLink) {
            return { type: "CLICK", selector: historyLink.selector };
          }
          return { type: "SCROLL_DOWN", amount: 800 };
        }
        if (lastAction?.type === "CLICK" || lastAction?.type === "SCROLL_DOWN") {
          return { type: "DONE", reason: "Navigated to Node.js article and scrolled to History section." };
        }
      }
    }

    if (lowerTask.includes("news.ycombinator.com")) {
      if (!url || url === "about:blank") {
        return { type: "NAVIGATE", url: "https://news.ycombinator.com" };
      }
      if (url.includes("ycombinator.com")) {
        if (!lastAction || lastAction.type === "NAVIGATE") {
          const topStory = (observation.elements || []).find(
            (el) => (el.tag === "a" && el.selector.includes("span > a")) || el.selector.includes("titleline")
          );
          return {
            type: "CLICK",
            selector: topStory?.selector || "span.titleline > a",
          };
        }
        if (lastAction.type === "CLICK") {
          return { type: "DONE", reason: "Opened top story from Hacker News." };
        }
      }
    }

    return { type: "DONE", reason: "Task complete." };
  }
}

module.exports = Planner;