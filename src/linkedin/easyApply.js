const { loadConfig } = require("../../config");
const { checkForChallenge, getRandomDelay } = require("./safety");

/**
 * Helper to check if visible form questions in the modal match known screening answers.
 * Returns { ok: true } if all questions are recognized, or { ok: false, question: string } if unrecognized.
 */
async function checkModalScreeningQuestions(page, screeningQuestions = {}) {
  const modalSelector = '.jobs-easy-apply-modal, div[role="dialog"], .artdeco-modal';
  const modal = page.locator(modalSelector);

  const isModalVisible = await modal.isVisible().catch(() => false);
  if (!isModalVisible) return { ok: true };

  const questionTexts = await page.evaluate((modalSel) => {
    const dialog = document.querySelector(modalSel);
    if (!dialog) return [];

    const prompts = [];
    const elements = dialog.querySelectorAll('label, legend, span.fb-form-element-label, span.jobs-easy-apply-form-section__label');
    elements.forEach((el) => {
      const txt = (el.innerText || "").trim().replace(/\s+/g, " ");
      if (txt && txt.length > 3 && !prompts.includes(txt)) {
        prompts.push(txt);
      }
    });
    return prompts;
  }, modalSelector);

  const STANDARD_FIELDS = [
    "email", "phone", "first name", "last name", "resume", "upload", "contact info",
    "country", "city", "address", "phone number", "summary", "profile", "headline", "mobile"
  ];

  for (const qText of questionTexts) {
    const qLower = qText.toLowerCase();

    if (STANDARD_FIELDS.some((std) => qLower.includes(std))) {
      continue;
    }

    const isRecognized = isQuestionRecognized(qLower, screeningQuestions);
    if (!isRecognized) {
      return { ok: false, question: qText };
    }
  }

  return { ok: true };
}

function isQuestionRecognized(qLower, screening) {
  if (!screening) return false;

  if (qLower.includes("experience") || qLower.includes("years of") || qLower.includes("how many years")) {
    return Boolean(screening.yearsOfExperience);
  }
  if (qLower.includes("sponsorship") || qLower.includes("sponsor") || qLower.includes("visa")) {
    return screening.sponsorshipRequired !== undefined;
  }
  if (qLower.includes("authorized") || qLower.includes("legally") || qLower.includes("work in")) {
    return screening.legallyAuthorized !== undefined;
  }
  if (qLower.includes("commute") || qLower.includes("relocate") || qLower.includes("hybrid") || qLower.includes("on-site")) {
    return screening.commuteOrRelocate !== undefined;
  }
  if (qLower.includes("degree") || qLower.includes("education") || qLower.includes("bachelor") || qLower.includes("master")) {
    return Boolean(screening.educationDegree);
  }
  if (qLower.includes("notice period") || qLower.includes("start date") || qLower.includes("available")) {
    return screening.noticePeriodDays !== undefined;
  }
  if (qLower.includes("salary") || qLower.includes("compensation") || qLower.includes("pay")) {
    return Boolean(screening.salaryExpectation);
  }
  if (qLower.includes("clearance") || qLower.includes("security clearance")) {
    return screening.securityClearance !== undefined;
  }

  return false;
}

/**
 * Dismisses/closes open Easy Apply modal and discards draft.
 */
async function dismissModal(page) {
  try {
    const closeBtn = page.locator('button[aria-label*="Dismiss"], button[aria-label*="Close"], button.artdeco-modal__dismiss');
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(500);

      const discardBtn = page.locator('button[data-control-name="discard_application_confirm_btn"], button:has-text("Discard")');
      if (await discardBtn.isVisible().catch(() => false)) {
        await discardBtn.click();
        await page.waitForTimeout(500);
      }
    }
  } catch (err) {
    console.warn(`⚠️ Warning while dismissing modal: ${err.message}`);
  }
}

/**
 * Automated Easy Apply Handler for a queued job record using observe-plan-act loop with safety rails.
 *
 * @param {Object} agent - AI Agent instance (browser, observer, planner, memory)
 * @param {Object} job - Queued job record { id, title, company, ... }
 * @param {Object} [options]
 * @param {boolean} [options.dryRun=true] - DRY-RUN mode flag (intercepts final submit click)
 * @param {number} [options.maxSteps=15] - Maximum steps allowed in Easy Apply modal loop
 * @param {Object} [options.config] - Filter and screening questions configuration
 * @param {Object} [options.store] - JobStore instance for persistence updates
 * @returns {Promise<Object>} Outcome status object
 */
async function applyToJob(agent, job, options = {}) {
  const {
    dryRun = true,
    maxSteps = 15,
    config: passedConfig,
    store,
  } = options;

  const config = passedConfig || loadConfig();
  const screeningQuestions = config.screeningQuestions || {};

  console.log("\n=================================================");
  console.log(`📝 EASY APPLY HANDLER: ${job.title} at ${job.company}`);
  console.log(`🔒 Mode: ${dryRun ? "DRY-RUN (Submissions Intercepted)" : "LIVE (Submissions Enabled)"}`);
  console.log("=================================================\n");

  const page = agent.browser.page;

  // 1. Initial CAPTCHA / Challenge safety check
  await checkForChallenge(page);

  const jobUrl = job.url || `https://www.linkedin.com/jobs/view/${job.id}/`;
  await agent.browser.goto(jobUrl);
  await agent.browser.randomDelay(
    config.actionDelayMinMs || 2000,
    config.actionDelayMaxMs || 4000
  );

  // 2. Post-navigation CAPTCHA / Challenge safety check
  await checkForChallenge(page);

  // Check for Easy Apply button
  const easyApplyBtnSelector = [
    "button.jobs-apply-button",
    "button[aria-label*='Easy Apply']",
    "button:has-text('Easy Apply')",
  ].join(", ");

  const easyApplyBtn = page.locator(easyApplyBtnSelector).first();
  const hasEasyApply = await easyApplyBtn.isVisible().catch(() => false);

  if (!hasEasyApply) {
    const pageText = await page.evaluate(() => document.body.innerText || "").catch(() => "");
    if (pageText.includes("Applied") || pageText.includes("Application submitted")) {
      console.log(`ℹ️ Already applied to job ${job.id}`);
      if (store) store.updateJobStatus(job.id, "applied", "Already applied on LinkedIn");
      return { status: "applied", reason: "Already applied on LinkedIn" };
    }

    console.warn(`⚠️ No Easy Apply button found for job ${job.id}`);
    if (store) store.updateJobStatus(job.id, "failed", "No Easy Apply button available");
    return { status: "failed", reason: "No Easy Apply button available" };
  }

  // Click Easy Apply button to open modal
  console.log("🖱️ Opening Easy Apply modal...");
  await easyApplyBtn.click();
  await agent.browser.randomDelay(
    config.actionDelayMinMs || 2000,
    config.actionDelayMaxMs || 4000
  );

  // 3. Post-modal click CAPTCHA / Challenge safety check
  await checkForChallenge(page);

  let stepCount = 0;
  let finalStatus = "in-progress";
  let statusReason = "";

  while (stepCount < maxSteps) {
    stepCount++;
    console.log(`\n--- Easy Apply Step ${stepCount}/${maxSteps} ---`);

    // Safety check: Check for CAPTCHA/challenge
    await checkForChallenge(page);

    // Check for unrecognized screening questions in modal
    const checkResult = await checkModalScreeningQuestions(page, screeningQuestions);
    if (!checkResult.ok) {
      statusReason = `Unrecognized screening question: "${checkResult.question}"`;
      console.warn(`🛑 CRITICAL: ${statusReason}`);
      console.log("🔒 Stopping application — flagging job for human review.");

      await dismissModal(page);
      finalStatus = "flagged_for_review";
      if (store) store.updateJobStatus(job.id, "flagged_for_review", statusReason);
      break;
    }

    // Observe page state
    const observation = await agent.observer.observe();

    // Re-check challenge with observation context
    await checkForChallenge(page, observation);

    // Formulate planner prompt with screening lookup table context
    const modalContextPrompt = `You are assisting with an Easy Apply modal for the position "${job.title}".
Screening Answers Lookup Table:
${JSON.stringify(screeningQuestions, null, 2)}
Resume File Path: "${config.resumePath || "data/resume.pdf"}"

Task: Step through the application modal. Fill form fields accurately using the screening answers lookup table.
If you reach the final "Submit application" or "Submit" button:
Decide to CLICK the submit button.`;

    // Get planner decision
    let action;
    try {
      action = await agent.planner.getNextAction(modalContextPrompt, observation, agent.memory.getRecentHistory(5));
      console.log("🧠 Modal Action:", JSON.stringify(action));
    } catch (err) {
      console.error("❌ Planner error in modal loop:", err.message);
      statusReason = `Planner error: ${err.message}`;
      finalStatus = "failed";
      await dismissModal(page);
      if (store) store.updateJobStatus(job.id, "failed", statusReason);
      break;
    }

    if (action.type === "DONE") {
      finalStatus = "applied";
      statusReason = action.reason || "Application modal process completed.";
      if (store) store.updateJobStatus(job.id, "applied", statusReason);
      break;
    }

    // Intercept final Submit click in DRY-RUN mode
    const isSubmitAction =
      action.type === "CLICK" &&
      (action.selector?.toLowerCase().includes("submit") ||
        action.reason?.toLowerCase().includes("submit"));

    if (isSubmitAction && dryRun) {
      console.log("\n=================================================");
      console.log(`🛡️ [DRY-RUN INTERCEPT] Would click Submit application button: ${action.selector}`);
      console.log("🔒 DRY-RUN mode active: Skipping actual submission and closing modal.");
      console.log("=================================================\n");

      await dismissModal(page);
      finalStatus = "applied";
      statusReason = "Applied (Dry Run Mode)";
      if (store) store.updateJobStatus(job.id, "applied", statusReason);
      break;
    }

    // Execute action
    try {
      if (action.type === "CLICK") await page.locator(action.selector).click().catch(() => {});
      else if (action.type === "TYPE") await page.locator(action.selector).fill(action.text).catch(() => {});
      else if (action.type === "SELECT") await page.locator(action.selector).selectOption(action.option || action.value).catch(() => {});
      else if (action.type === "CHECK") await page.locator(action.selector).check().catch(() => {});
      else if (action.type === "UPLOAD_FILE") await page.locator(action.selector).setInputFiles(action.filePath || action.file).catch(() => {});

      // Human-like randomized action delay from config
      const actionDelay = getRandomDelay(
        config.actionDelayMinMs || 3000,
        config.actionDelayMaxMs || 8000
      );
      console.log(`⏳ Human-like action delay: ${Math.round(actionDelay / 1000)}s...`);
      await page.waitForTimeout(actionDelay);
    } catch (err) {
      console.warn(`⚠️ Action [${action.type}] execution warning: ${err.message}`);
    }
  }

  if (finalStatus === "in-progress" && stepCount >= maxSteps) {
    statusReason = `Exceeded MAX_STEPS cap (${maxSteps} steps)`;
    console.warn(`🛑 ${statusReason}`);
    await dismissModal(page);
    finalStatus = "flagged_for_review";
    if (store) store.updateJobStatus(job.id, "flagged_for_review", statusReason);
  }

  console.log(`✅ Easy Apply finished for job ${job.id} with status: [${finalStatus}]`);
  return { status: finalStatus, reason: statusReason, dryRun };
}

module.exports = {
  applyToJob,
  checkModalScreeningQuestions,
  dismissModal,
};
