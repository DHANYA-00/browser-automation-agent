async function executeAction(browser, action) {
  if (!action || !action.type) {
    throw new Error("Invalid action");
  }

  switch (action.type) {
    case "NAVIGATE":
      await browser.goto(action.url);
      break;

    case "CLICK":
      await browser.click(action.selector);
      break;

    case "TYPE":
      await browser.type(action.selector, action.text);
      break;

    case "PRESS":
      await browser.press(action.key);
      break;

    case "HOVER":
      await browser.hover(action.selector);
      break;

    case "SCROLL_DOWN":
      await browser.scrollDown(action.amount || 600);
      break;

    case "SCROLL_UP":
      await browser.scrollUp(action.amount || 600);
      break;

    case "WAIT":
      await browser.wait(action.ms || 1000);
      break;

    case "WAIT_FOR_SELECTOR":
      await browser.waitForSelector(action.selector);
      break;

    case "SCREENSHOT":
      await browser.screenshot(action.name || "page.png");
      break;

    case "RELOAD":
      await browser.reload();
      break;

    case "BACK":
      await browser.back();
      break;

    case "FORWARD":
      await browser.forward();
      break;

    case "DONE":
      return true;

    default:
      throw new Error(`Unknown action: ${action.type}`);
  }

  return false;
}

module.exports = {
  executeAction,
};