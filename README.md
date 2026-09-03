# LinkedIn Job Automation Agent

An autonomous, Playwright-powered Node.js agent that automates LinkedIn job searching, card extraction, deterministic filtering, screening question matching, account safety protections, and Easy Apply application workflows.

---

## Status & Validation

- **Dry-Run Validation**: Completed & Verified. Evaluated pipeline against batch datasets with 100% answer accuracy and zero hallucinated inputs.
- **Live Testing**: Live-tested with low-cap execution (5 applications), verified against LinkedIn's "My Jobs ➔ Applied" ground truth list.
- **Current Ongoing Operating Cap**: Default set to **15 applications/day** (`config/default.json`).

---

## Key Features

- **Observe-Plan-Act Loop**: Autonomous page observation, DOM selector extraction, LLM planning (with intelligent mock mode fallback), and Playwright action execution.
- **Session Persistence**: Saves and reuses authenticated state (`data/session.json`) to bypass login forms.
- **Deterministic Filter Engine**: Rule-based job evaluation using inclusion/exclusion keywords, company blacklists, and posting freshness (`config/default.json`).
- **Easy Apply Modal Handler**: Automates multi-step forms (text, dropdowns, checkboxes, resume upload) with screening lookup table matching (`screeningQuestions`).
- **Multi-Layer Safety Rails**:
  - **Daily Application Cap**: Enforces `dailyApplicationCap` (default 15/day).
  - **Human-like Delays**: Configurable random action delays (3–8s) and job delays (30–90s).
  - **CAPTCHA & Security Challenge Hard Stop**: Immediate exit on security challenges with emergency screenshot capture (`screenshots/captcha_detected.png`).
  - **Screening Question Guardrails**: Flags unrecognized questions or essay prompts (`"flagged_for_review"`) instead of guessing.
- **Review Queue CLI**: Inspect and resolve flagged jobs via `scripts/review-queue.js`.

---

## Architecture & Safety Technical Details

For detailed technical specs, module breakdown, and safety rail implementation, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```

   **Required Settings**:
   - `LINKEDIN_EMAIL` / `LINKEDIN_PASSWORD` *(optional if saved session exists)*.
   - `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` *(optional, runs in mock planner mode if absent)*.

---

## Usage & Commands

### 1. Interactive LinkedIn Login (Initial Setup)
Generates persistent session state in `data/session.json`:
```bash
npm run login
```

### 2. Review Queue CLI Tool
Inspect and resolve jobs flagged for human review:
```bash
# List all flagged jobs with exact question text & reasons
node scripts/review-queue.js list

# Resolve a job back to queued status for retry
node scripts/review-queue.js resolve <jobId>
```

### 3. Run Pipeline in Dry-Run Mode (Validation)
Runs complete pipeline with dry-run submission interception:
```bash
node scripts/run-end-to-end-dryrun.js
```

### 4. Run Pipeline Live (Production)
Executes live Easy Apply applications respecting safety rails:
```bash
node scripts/run-live-pipeline.js
```

---

## Configuration (`config/default.json`)

Key safety and filter parameters:
```json
{
  "dailyApplicationCap": 15,
  "actionDelayMinMs": 3000,
  "actionDelayMaxMs": 8000,
  "jobDelayMinMs": 30000,
  "jobDelayMaxMs": 90000,
  "easyApplyOnly": true,
  "screeningQuestions": {
    "yearsOfExperience": {
      "default": 3,
      "javascript": 3,
      "node": 3,
      "react": 3,
      "typescript": 3,
      "playwright": 2,
      "python": 2
    },
    "sponsorshipRequired": false,
    "legallyAuthorized": true,
    "commuteOrRelocate": true,
    "educationDegree": "Bachelor's Degree",
    "noticePeriodDays": 0,
    "salaryExpectation": "120000",
    "securityClearance": false
  }
}
```
