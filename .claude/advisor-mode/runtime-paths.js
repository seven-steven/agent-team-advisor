const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');

function projectKey(rootDir) {
  return crypto.createHash('sha256').update(path.resolve(rootDir)).digest('hex').slice(0, 16);
}

function getAdvisorRuntimeRoot(rootDir, options = {}) {
  if (options.runtimeRoot) return options.runtimeRoot;
  if (process.env.ADVISOR_MODE_RUNTIME_ROOT) return process.env.ADVISOR_MODE_RUNTIME_ROOT;
  return path.join(os.homedir(), '.claude', 'advisor-mode', 'runtime', projectKey(rootDir));
}

function runtimePath(rootDir, segments = [], options = {}) {
  return path.join(getAdvisorRuntimeRoot(rootDir, options), ...segments);
}

module.exports = {
  getAdvisorRuntimeRoot,
  runtimePath,
};
