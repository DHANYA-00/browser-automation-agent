const fs = require("fs");

class SecurityChallengeError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "SecurityChallengeError";
    this.details = details;
  }
}

/**
 * Inspects current browser page and observation state for CAPTCHA or Security Challenge prompts.
 * If detected, takes a screenshot, logs a critical alert, and throws a SecurityChallengeError to HARD-STOP execution.
 *
 * @param {import('playwright').Page} page
 * @param {Object} [observation]
 * @returns {Promise<boolean>} Returns false if clean. Throws SecurityChallengeError if challenge detected.
 */
async function checkForChallenge(page, observation = {}) {
  if (!page || page.isClosed()) return false;

  const url = page.url() || "";
  const title = (await page.title().catch(() => "")) || "";

  // 1. Check URL patterns
  const CHALLENGE_URL_PATTERNS = [
    "/checkpoint/",
    "/challenge/",
    "/security/",
    "/verify/",
    "/unusual-activity",
    "captcha",
  ];
  const urlMatch = CHALLENGE_URL_PATTERNS.find((p) => url.toLowerCase().includes(p));

  // 2. Check DOM text / headings
  const pageText = await page.evaluate(() => document.body.innerText || "").catch(() => "");
  const textLower = (pageText + " " + title).toLowerCase();

  const CHALLENGE_TEXT_PATTERNS = [
    "security check",
    "verify it's you",
    "verify your identity",
    "unusual activity",
    "enter verification code",
    "enter the code",
    "quick security check",
    "solve the puzzle",
    "select the matching",
    "please solve this puzzle",
    "security verification",
  ];
  const textMatch = CHALLENGE_TEXT_PATTERNS.find((t) => textLower.includes(t));

  // 3. Check DOM selector elements
  const CHALLENGE_SELECTORS = [
    'input[name="pin"]',
    'input[id*="pin"]',
    "#captcha",
    ".captcha",
    'iframe[src*="captcha"]',
    'iframe[src*="recaptcha"]',
    'iframe[src*="funcaptcha"]',
    'iframe[src*="arkoselabs"]',
    'form[action*="checkpoint"]',
    'form[action*="challenge"]',
    '[data-test-id*="checkpoint"]',
    '[data-test-id*="challenge"]',
  ];

  let selectorMatch = null;
  for (const sel of CHALLENGE_SELECTORS) {
    const visible = await page.locator(sel).first().isVisible().catch(() => false);
    if (visible) {
      selectorMatch = sel;
      break;
    }
  }

  if (urlMatch || textMatch || selectorMatch) {
    const reason = urlMatch
      ? `Challenge URL pattern matched: "${urlMatch}"`
      : textMatch
      ? `Challenge page text matched: "${textMatch}"`
      : `Challenge element selector matched: "${selectorMatch}"`;

    console.error("\n=================================================");
    console.error("🚨 CAPTCHA / SECURITY CHALLENGE DETECTED!");
    console.error(`📌 Reason: ${reason}`);
    console.error(`🔗 Current URL: ${url}`);
    console.error("🛑 HARD STOPPING EXECUTION IMMEDIATELY — NO RETRIES ALLOWED.");
    console.error("=================================================\n");

    try {
      if (!fs.existsSync("screenshots")) fs.mkdirSync("screenshots", { recursive: true });
      await page.screenshot({ path: "screenshots/captcha_detected.png", fullPage: true });
      console.error("📸 Captured emergency screenshot: screenshots/captcha_detected.png");
    } catch (e) {}

    throw new SecurityChallengeError(reason, { url, title, signal: reason });
  }

  return false;
}

/**
 * Generates a random integer delay between minMs and maxMs.
 * @param {number} minMs 
 * @param {number} maxMs 
 * @returns {number} Delay in milliseconds
 */
function getRandomDelay(minMs = 1000, maxMs = 3000) {
  const min = Math.min(minMs, maxMs);
  const max = Math.max(minMs, maxMs);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  checkForChallenge,
  SecurityChallengeError,
  getRandomDelay,
};
