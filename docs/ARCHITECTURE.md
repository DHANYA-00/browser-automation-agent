# System Architecture & Safety Rails

## Overview
This repository contains an autonomous, Playwright-based AI browser agent designed to automate LinkedIn job discovery and Easy Apply application workflows safely. The agent follows a modular **Observe-Plan-Act** architecture with deterministic data persistence, screening question matching, account safety protections, and a human review CLI.

```
       ┌────────────────────────┐
       │   Observer (Observer)  │ ─── 1. Observe Page State & Interactivity
       └───────────┬────────────┘
                   │
                   ▼
       ┌────────────────────────┐
       │    Planner (LLM/Mock)  │ ─── 2. Decide Atomic Browser Action
       └───────────┬────────────┘
                   │
                   ▼
       ┌────────────────────────┐
       │     Action Executor    │ ─── 3. Perform Playwright Browser Action
       └────────────────────────┘
```

---

## Validation & Live Status

- **Dry-Run Validation**: Completed & Verified. Evaluated 9 jobs across full pipeline (3 "would apply", 4 filtered out, 2 flagged for human review, 0 errors).
- **Live Testing**: Completed & Verified. Live-tested with low-cap (5 applications), confirmed ground truth matching on LinkedIn's "My Jobs ➔ Applied" page.
- **Ongoing Operating Cap**: Default daily cap set to **15 applications/day** (`config/default.json`).

---

## The Observe-Plan-Act Loop

1. **Observe (`src/agent/observer.js`)**:
   - Inspects active Playwright browser tab.
   - Extracts page metadata (URL, page title) and screenshot artifacts.
   - Parses interactable DOM elements (inputs, buttons, dropdowns, links) and generates stable CSS selectors for the planner.

2. **Plan (`src/agent/planner.js`)**:
   - Formulates structured prompts containing task goals, screening lookup tables, current DOM observations, and recent action history.
   - Calls LLM API (OpenAI/Anthropic) or falls back to intelligent deterministic mock mode when API keys are absent.
   - Output action format: `{ type: "NAVIGATE" | "CLICK" | "TYPE" | "SELECT" | "CHECK" | "UPLOAD_FILE" | "DONE", ... }`.

3. **Act (`src/browser/actions.js` & `src/browser/browser.js`)**:
   - Executes atomic Playwright actions against the active browser context.
   - Handles failure detection, error capture, and consecutive retry/recovery tracking in `Memory`.

---

## Safety Rails & Account Protections

The system incorporates multi-layered account safety rails to guarantee compliance and protect the account:

1. **Daily Application Cap (`src/linkedin/persistence.js` & `queueRunner.js`)**:
   - Tracks total applications submitted today (`YYYY-MM-DD`).
   - Hard-stops queue processing as soon as `getAppliedCountToday() >= dailyApplicationCap` (default: `15`).

2. **Human-like Randomized Pacing Delays (`src/linkedin/safety.js`)**:
   - **Action Delays**: Random pause between 3,000ms and 8,000ms between modal clicks/inputs.
   - **Job Delays**: Random pause between 30,000ms and 90,000ms between separate job applications.

3. **Screening Question Lookup Validation (`src/linkedin/easyApply.js`)**:
   - Answers questions using `config/default.json` lookup table.
   - If an unrecognized question, custom prompt, or essay is encountered, the job is immediately stopped and assigned status `"flagged_for_review"`.

4. **CAPTCHA & Security Challenge Hard Stop (`src/linkedin/safety.js`)**:
   - `checkForChallenge(page)` checks URL patterns (`/checkpoint/`, `/challenge/`), page text (`"Security Check"`, `"Verify it's you"`), and challenge iframes (reCAPTCHA, Arkose Labs).
   - If detected: Saves emergency screenshot (`screenshots/captcha_detected.png`) and throws `SecurityChallengeError` to **immediately terminate execution without retries**.

5. **Review Queue CLI Tool (`scripts/review-queue.js`)**:
   - CLI utility to list flagged jobs (`list`) with exact reason/question text, and resolve them (`resolve <jobId>`) back to `"queued"` for retry after config tuning.

---

## Module Responsibilities

### Core Agent (`src/agent/`)
- `agent.js`: Main loop controller managing step caps, error recovery, and task status.
- `observer.js`: Extracts DOM state and interactive elements.
- `planner.js`: Translates task goals and observations into discrete actions.
- `memory.js`: Tracks task objectives and execution history log.

### Browser Layer (`src/browser/`)
- `browser.js`: Controls Playwright browser instance, stealth human delays, and session authentication (`data/session.json`).
- `actions.js`: Implements low-level DOM interactions (`CLICK`, `TYPE`, `SELECT`, `CHECK`, `UPLOAD_FILE`).

### LinkedIn Domain Logic (`src/linkedin/`)
- `jobSearch.js`: Constructs LinkedIn search URLs (`buildSearchUrl`) and extracts job cards (`extractJobCards`).
- `filterJobs.js`: Deterministic rule engine for evaluating jobs against keywords, blacklists, and listing freshness (`applyFilters`).
- `persistence.js`: `JobStore` class managing deduplication and persistence to `data/jobs.json`.
- `easyApply.js`: Manages Easy Apply application steps, modal dismissal, and screening question validation.
- `safety.js`: Implements `checkForChallenge()`, `SecurityChallengeError`, and `getRandomDelay()`.
- `queueRunner.js`: Controls queue execution loop, daily cap enforcement, and job pacing.
