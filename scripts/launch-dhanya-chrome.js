// scripts/launch-dhanya-chrome.js
const { spawn, execSync } = require('child_process');
const http = require('http');
const playwright = require('playwright');

const PORT = 9222;

/**
 * Finds an available Chrome or Chromium binary on the system,
 * falling back to Playwright's bundled browser if none are found.
 */
function findChromeExecutable() {
  const binaries = ['google-chrome', 'chromium-browser', 'chromium'];
  for (const bin of binaries) {
    try {
      execSync(`which ${bin}`, { stdio: 'ignore' });
      console.log(`[Chrome Launcher] Found system browser binary: ${bin}`);
      return bin;
    } catch (e) {
      // Binary not found in PATH
    }
  }

  const bundledPath = playwright.chromium.executablePath();
  console.log(`[Chrome Launcher] System Chrome not found. Using Playwright bundled binary: ${bundledPath}`);
  return bundledPath;
}

const chromeBin = findChromeExecutable();

const chromeArgs = [
  `--remote-debugging-port=${PORT}`,
  '--remote-debugging-address=0.0.0.0',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--user-data-dir=/tmp/chrome-dhanya-profile'
];

if (!process.env.DISPLAY) {
  chromeArgs.push('--headless=new');
}

console.log(`[Chrome Launcher] Launching ${chromeBin} with flags: ${chromeArgs.join(' ')}`);

// Pipe stdout/stderr so we can see why Chrome fails if it crashes
const chromeProcess = spawn(chromeBin, chromeArgs, {
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe']
});

chromeProcess.stdout.on('data', (data) => console.log(`[Chrome STDOUT] ${data.toString().trim()}`));
chromeProcess.stderr.on('data', (data) => console.warn(`[Chrome STDERR] ${data.toString().trim()}`));

chromeProcess.unref();

// Health check to verify CDP endpoint
async function verifyCDP(retries = 10) {
  for (let i = 0; i < retries; i++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${PORT}/json/version`, (res) => {
          if (res.statusCode === 200) resolve();
          else reject();
        });
        req.on('error', reject);
      });
      console.log(`[Chrome Launcher] SUCCESS: CDP endpoint live at http://127.0.0.1:${PORT}`);
      return true;
    } catch (e) {
      // Retry...
    }
  }
  console.error(`[Chrome Launcher] ERROR: CDP health check timed out on port ${PORT}. See STDERR logs above.`);
  return false;
}

verifyCDP();