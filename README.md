# LinkedIn Job Automation Agent

An autonomous, Playwright-powered Node.js agent that automates LinkedIn job searching, card extraction, deterministic filtering, and persistent storage.

## Features

- **Observe-Plan-Act Loop**: Automated page state observation, LLM action planning (with mock mode fallback), and Playwright action execution.
- **Session Persistence**: Saves and reuses LinkedIn login cookies (`data/session.json`) to bypass interactive logins across runs.
- **Deterministic Filter Engine**: Rule-based job evaluation using keyword inclusion/exclusion, company blacklists, and posting date limits (`config/default.json`).
- **Deduplicated Job Storage**: Atomic JSON persistence (`data/jobs.json`) preventing duplicate job additions while preserving existing status.

---

## Architecture

For a detailed technical overview of the Observe-Plan-Act loop, module responsibilities, and data flow, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in credentials:
   ```bash
   cp .env.example .env
   ```

   **Required Environment Variables**:
   - `LINKEDIN_EMAIL` *(optional if saved session exists)*: LinkedIn account email.
   - `LINKEDIN_PASSWORD` *(optional if saved session exists)*: LinkedIn account password.
   - `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` *(optional)*: LLM key for planner. If absent, agent runs in mock planner mode.

---

## Usage

### 1. Interactive LinkedIn Login (Initial Setup)
Run the manual login utility script to authenticate and generate `data/session.json`:
```bash
npm run login
```

### 2. Run the Main Agent
Start the autonomous job search agent:
```bash
npm start
```

### 3. Run Automated Tests
Execute the automated test suite (unit deduplication, filter rules, DOM extraction, retry logic):
```bash
npm test
```

### 4. Developer / Debug Scripts
- `npm run search-demo`: Live search & extraction demo against LinkedIn.
- `npm run eval-tasks`: Multi-task agent evaluation benchmark.
