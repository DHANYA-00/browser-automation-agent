const fs = require("fs");
const path = require("path");

/**
 * Loads and parses filter configuration from JSON file.
 * Throws an error if the file is missing or contains invalid JSON.
 *
 * @param {string} [configPath] - Custom path to config file. Defaults to config/default.json.
 * @returns {Object} Parsed configuration object
 */
function loadConfig(configPath) {
  const targetPath = configPath || path.join(__dirname, "default.json");

  if (!fs.existsSync(targetPath)) {
    throw new Error(`Configuration file missing at path: ${targetPath}`);
  }

  try {
    const rawData = fs.readFileSync(targetPath, "utf-8");
    return JSON.parse(rawData);
  } catch (err) {
    throw new Error(`Failed to load or parse configuration JSON at ${targetPath}: ${err.message}`);
  }
}

module.exports = {
  loadConfig,
};
