# AI Browser Operator

This project is a browser automation foundation for building an AI-powered browser agent that can understand a user task, inspect the current webpage, decide the next step, and perform that action through Playwright. The goal is to evolve from simple scripted browser actions toward a more general, adaptive browser operator that can handle real-world workflows.

## Purpose

The main purpose of this project is to create an AI-assisted browser automation system that can:

- understand a task expressed in plain language
- observe the current page state
- decide the next action based on what is visible
- execute that action in the browser
- verify the result and continue the loop
- retain memory of what has happened so far

This is not being built as a single-purpose script. It is designed as a general browser automation architecture that can eventually support many practical workflows.

LinkedIn job search and application assistance is the first major real-world use case, but the architecture is intended to remain general enough for other browser-based tasks as well.

## How It Works

```text
User Task
   ↓
Agent
   ↓
Observe webpage
   ↓
Plan next action
   ↓
Act in browser
   ↓
Verify result
   ↓
Memory / history
   ↓
Repeat
```

At a high level, the project is structured around a few core pieces:

- Observer: inspects the current DOM and extracts the page structure, visible text, and key elements.
- Planner: decides the next action based on the task, current observation, and recent history.
- Agent: runs the main task loop and tracks progress, failures, and completion status.
- Browser layer: wraps Playwright and executes actions such as navigation, clicks, typing, waits, and page interaction.
- Memory: stores recent action history and task state.

## Current Status

The project is currently under active development and is best understood as a working foundation for an AI browser agent rather than a fully autonomous production system.

- Playwright browser abstraction and basic browser action handling are implemented.
- The core agent, observer, planner, and memory structure exist.
- A basic browser automation workflow is in place and can run task-driven browser actions.
- LLM-based planning is available as an integration path, but the system still depends on API configuration and mock fallback behavior when keys are not present.
- LinkedIn job search and job processing are active next-stage work, not a complete automation pipeline.
- Full application automation is a future stage of the project.

## Project Structure

```text
src/
├── agent/
│   ├── agent.js
│   ├── memory.js
│   ├── observer.js
│   └── planner.js
├── browser/
│   ├── actions.js
│   └── browser.js
├── linkedin/
│   ├── batch-runner.js
│   ├── easyApply.js
│   ├── filterJobs.js
│   ├── index.js
│   ├── jobSearch.js
│   ├── persistence.js
│   ├── queueRunner.js
│   └── safety.js
├── index.js

data/
├── chrome-profile/
├── jobs.json
├── test_easy_apply_jobs.json
├── test_jobs.json

scripts/
├── launch-dhanya-chrome.js
├── linkedin-login.js
├── review-queue.js
├── run-end-to-end-dryrun.js
├── run-live-pipeline.js
├── test-job-search.js
├── test-observer.js
├── test-tasks.js

tests/
├── example.spec.js
├── test-dom-extraction.js
├── test-easy-apply.js
├── test-filter-jobs.js
├── test-persistent-browser.js
├── test-retry.js
├── test-review-queue.js
├── test-safety-rails.js
├── test-unit-dedupe.js

config/
├── default.json
├── index.js

docs/
└── ARCHITECTURE.md
```

The main files are:

- `src/index.js`: project entry point
- `src/agent/agent.js`: main task loop and execution control
- `src/agent/observer.js`: page observation and DOM extraction
- `src/agent/planner.js`: action selection logic and optional LLM integration
- `src/agent/memory.js`: short-term state and action history
- `src/browser/browser.js`: Playwright browser wrapper
- `src/browser/actions.js`: browser action execution
- `src/linkedin/`: LinkedIn-specific search, filtering, queueing, and safety logic

## Tech Stack

- JavaScript
- Node.js
- Playwright
- Chrome / Chromium
- Git / GitHub
- LLM planning integration (optional and still evolving)

## Getting Started

Install dependencies:

```bash
npm install
```

Install the browser used by Playwright:

```bash
npx playwright install chromium
```

Run the project:

```bash
npm start
```

Useful project scripts from `package.json`:

```bash
npm run login
npm run search-demo
npm run eval-tasks
npm run chrome:dhanya
```

## Development Roadmap

1. Browser automation foundation
2. Agent architecture and task loop
3. Better page observation and memory
4. LLM-powered planning integration
5. More reliable browser execution loop
6. LinkedIn job search and result extraction
7. Batch processing and job filtering
8. Future application assistance workflows

## Safety / Automation Approach

This project is intentionally designed with caution in mind:

- existing authenticated browser sessions may be reused when available
- credentials should not be hardcoded into the project
- CAPTCHA, security checks, and two-factor flows should not be bypassed
- sensitive actions should eventually require clear human review or confirmation
- the system should stop safely when a page presents a challenge or an uncertain state

## Future Vision

The long-term goal is a general AI browser operator that can handle real-world browser tasks by combining observation, reasoning, execution, verification, and memory.

```text
Natural language task
   ↓
Observe page state
   ↓
Plan next step
   ↓
Validate intent
   ↓
Act in browser
   ↓
Verify outcome
   ↓
Memory and learning
   ↓
Repeat
```

The immediate practical use case is LinkedIn job search and workflow support, but the broader vision is a reusable browser agent for many daily web workflows.

## Project

This project is a personal / experimental automation repository focused on building a practical AI browser operator.
