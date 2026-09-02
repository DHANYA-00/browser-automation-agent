# AI Browser Operator

A browser automation agent built with **Node.js** and **Playwright**. It takes a task written in plain English, looks at the current webpage, decides what to click or type next, does it, and repeats — instead of running a fixed, pre-written script.

For example:

```text
Search for OpenAI on Google
```

The agent figures out the steps itself by reading the page after every action, rather than following a script written specifically for that task.

## Goal

The long-term goal is to use this agent to automate job applications on LinkedIn — searching for relevant jobs and applying automatically.

Development is being done step by step, starting with a reliable general-purpose browser agent before adding LinkedIn-specific behavior on top of it.

## How It Works

The agent follows an **Observe → Plan → Act → Repeat** loop:

1. **Observe** – Look at the current page: title, URL, and every visible button, link, and input field.
2. **Plan** – Decide the single next action to take based on the task and what's currently on screen.
3. **Act** – Perform that action, such as clicking, typing, scrolling, or waiting.
4. **Repeat** – Go back to step 1 until the task is finished or a safety limit is reached.

This loop allows the agent to react to what actually happens on the page instead of assuming that a fixed sequence of steps will always work.

## Project Structure

```text
src/
  agent/
    observer.js   # Reads the page and lists what's clickable/typeable
    planner.js    # Decides the next action to take
    agent.js      # Runs the observe → plan → act loop
    memory.js     # Keeps track of past actions

  browser/
    browser.js    # Playwright wrapper (navigate, click, type, etc.)
    actions.js    # Fixed list of actions the agent can perform

  index.js        # Entry point
```

## Tech Stack

* **Node.js**
* **Playwright** – Browser automation
* **LLM API** – Used by the planner to decide each next action

## Getting Started

Install the project dependencies:

```bash
npm install
```

Install the Chromium browser required by Playwright:

```bash
npx playwright install chromium
```

Start the agent:

```bash
node src/index.js
```

The task is configured in `src/index.js`. Change the task text to try a different instruction.

## Current Status

### Working

* The agent can take a simple task, observe a webpage, and complete it step by step without a hardcoded script.
* Handles basic actions:

  * Navigating
  * Clicking
  * Typing
  * Scrolling
  * Waiting for elements to appear
* Retries automatically if an action fails.
* Stops safely instead of looping forever.

### In Progress

The following features are being developed as the project moves toward LinkedIn automation:

* Extending the agent to handle longer, multi-step real-world tasks.
* Adding LinkedIn login and session handling.
* Adding LinkedIn job search and job listing extraction.
* Auto-filling job applications through **Easy Apply** will follow once the above functionality is solid.
