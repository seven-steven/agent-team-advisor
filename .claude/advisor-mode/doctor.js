#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { runtimePath } = require('./runtime-paths.js');
const { appendAuditEvent, readAuditEvents, sanitizeAuditEvent } = require('./audit-log.js');
const { loadBudgetPolicy } = require('./budget-state.js');
const { readOperatorMode } = require('./operator-recovery.js');
const { loadRouteConfig } = require('./provider-routing.js');

const CHECK_IDS = [
  'install.assets',
  'hooks.wiring',
  'advisor.permissions',
  'provider.routes',
  'provider.conformance',
  'runtime.paths',
  'audit.raw_stream',
  'budget.policy',
  'recovery.mode',
];

const REQUIRED_ASSETS = [
  '.claude/settings.json',
  '.claude/agents/advisor-reviewer.md',
  '.claude/advisor-mode/policy.example.json',
  '.claude/advisor-mode/provider-routes.example.json',
  '.planning/config.json',
];

const REQUIRED_HOOKS = [
  'advisor-gate.js',
  'advisor-final-review-gate.js',
  'advisor-failure-tracker.js',
  'executor-route-audit.js',
];

const FORBIDDEN_ADVISOR_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'Bash']);
const REQUIRED_ADVISOR_TOOLS = new Set(['Read', 'Grep', 'Glob']);

function getRoot(options = {}) {
  return options.root || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function pass(id, summary, repair = 'No repair needed.') {
  return { id, status: 'pass', summary, repair };
}

function fail(id, summary, repair) {
  return { id, status: 'fail', summary, repair };
}

function safeErrorMessage(error) {
  return String((error && error.message) || error || 'unknown error')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, '[REDACTED]')
    .replace(/sk-[A-Za-z0-9._-]+/gi, '[REDACTED]')
    .replace(/TEST_TOKEN_PLACEHOLDER/g, '[REDACTED]');
}

function flattenHookCommands(settings) {
  if (!settings || !isPlainObject(settings.hooks)) return [];
  const commands = [];
  for (const entries of Object.values(settings.hooks)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      for (const hook of Array.isArray(entry && entry.hooks) ? entry.hooks : []) {
        if (typeof hook.command === 'string') commands.push(hook.command);
      }
    }
  }
  return commands;
}

function parseAgentTools(agentText) {
  const toolsLine = agentText.split(/\r?\n/).find((line) => /^tools\s*:/i.test(line.trim()));
  if (!toolsLine) return [];
  return toolsLine.split(':').slice(1).join(':').split(',').map((tool) => tool.trim()).filter(Boolean);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function checkInstallAssets(options = {}) {
  const root = getRoot(options);
  const missing = REQUIRED_ASSETS.filter((asset) => !fs.existsSync(path.join(root, asset)));
  if (missing.length > 0) {
    return fail('install.assets', `Missing required Advisor Mode assets: ${missing.join(', ')}`, 'Re-run the Advisor Mode scaffold/init workflow or restore the listed project assets.');
  }
  return pass('install.assets', 'All required Advisor Mode project assets are present.');
}

async function checkHooksWiring(options = {}) {
  const root = getRoot(options);
  const settingsPath = path.join(root, '.claude', 'settings.json');
  try {
    const commands = flattenHookCommands(readJson(settingsPath));
    const missing = REQUIRED_HOOKS.filter((hook) => !commands.some((command) => command.includes(hook)));
    if (missing.length > 0) {
      return fail('hooks.wiring', `Missing hook commands: ${missing.join(', ')}`, `Restore .claude/settings.json hook registrations for ${missing.join(', ')} including advisor-gate.js.`);
    }
    return pass('hooks.wiring', 'Advisor Mode hook commands are registered in project settings.');
  } catch (error) {
    return fail('hooks.wiring', `Unable to read hook settings: ${safeErrorMessage(error)}`, 'Restore valid JSON in .claude/settings.json with Advisor Mode hook registrations.');
  }
}

async function checkAdvisorPermissions(options = {}) {
  const root = getRoot(options);
  const agentPath = path.join(root, '.claude', 'agents', 'advisor-reviewer.md');
  try {
    const text = fs.readFileSync(agentPath, 'utf8');
    const tools = parseAgentTools(text);
    const forbidden = tools.filter((tool) => FORBIDDEN_ADVISOR_TOOLS.has(tool));
    const missing = [...REQUIRED_ADVISOR_TOOLS].filter((tool) => !tools.includes(tool));
    if (forbidden.length > 0 || missing.length > 0) {
      return fail('advisor.permissions', `Advisor tool declaration is not read-only: ${tools.join(', ') || 'none'}`, 'Set advisor-reviewer tools to Read, Grep, Glob only; remove Write, Edit, MultiEdit, and Bash.');
    }
    return pass('advisor.permissions', 'Advisor reviewer declares read-only tools only.');
  } catch (error) {
    return fail('advisor.permissions', `Unable to read advisor agent: ${safeErrorMessage(error)}`, 'Restore .claude/agents/advisor-reviewer.md with tools: Read, Grep, Glob.');
  }
}

async function checkProviderRoutes(options = {}) {
  const root = getRoot(options);
  const loaded = loadRouteConfig(options.routeConfigPath, { root });
  if (!loaded.ok) {
    return fail('provider.routes', `Provider routes are invalid: ${loaded.errors.join('; ')}`, 'Fix .claude/advisor-mode/provider-routes.example.json so semantic aliases validate without literal secrets.');
  }
  return pass('provider.routes', `Provider routes validate for aliases: ${Object.keys(loaded.config.routes).join(', ')}.`);
}

async function checkProviderConformance(options = {}) {
  const root = getRoot(options);
  const candidates = [
    runtimePath(root, ['state', 'provider-conformance.json'], options),
    path.join(root, '.advisor', 'state', 'provider-conformance.json'),
  ];
  const statePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!statePath) {
    return fail('provider.conformance', 'No provider conformance state artifact found.', 'Run provider conformance first, for example: node .claude/advisor-mode/provider-conformance.js --mock pass --alias opus.');
  }
  try {
    const artifact = readJson(statePath);
    if (artifact.event !== 'provider_conformance.completed' || !['pass', 'fail'].includes(artifact.status)) {
      return fail('provider.conformance', 'Provider conformance artifact has an unexpected shape.', 'Re-run provider conformance to refresh the route health artifact.');
    }
    if (artifact.status !== 'pass') {
      return fail('provider.conformance', 'Latest provider conformance status is fail.', 'Review failed conformance checks, fix provider routing or gateway behavior, then re-run provider conformance.');
    }
    return pass('provider.conformance', 'Latest provider conformance artifact reports pass.');
  } catch (error) {
    return fail('provider.conformance', `Unable to read provider conformance state: ${safeErrorMessage(error)}`, 'Re-run provider conformance to write a valid state artifact.');
  }
}

async function checkRuntimePaths(options = {}) {
  const root = getRoot(options);
  try {
    for (const segment of ['audit', 'state']) {
      const dir = runtimePath(root, [segment], options);
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, `.doctor-${process.pid}.tmp`);
      fs.writeFileSync(probe, 'ok');
      fs.rmSync(probe);
    }
    return pass('runtime.paths', 'Runtime audit and state paths are writable.');
  } catch (error) {
    return fail('runtime.paths', `Runtime path write check failed: ${safeErrorMessage(error)}`, 'Ensure the runtime root is writable or pass --runtime-root to a writable directory.');
  }
}

async function checkAuditRawStream(options = {}) {
  const root = getRoot(options);
  try {
    const result = appendAuditEvent({ event: 'doctor.audit_probe', status: 'pass', correlationKey: 'doctor-audit-probe' }, { ...options, root });
    const read = readAuditEvents({ ...options, root });
    const found = read.events.some((event) => event.event === 'doctor.audit_probe' && event.correlationKey === 'doctor-audit-probe');
    if (!found) return fail('audit.raw_stream', 'Audit probe was not readable from the raw stream.', 'Check runtime audit path permissions and append-only JSONL integrity.');
    return pass('audit.raw_stream', `Append-only audit stream is readable at ${result.auditPath}.`);
  } catch (error) {
    return fail('audit.raw_stream', `Audit raw stream check failed: ${safeErrorMessage(error)}`, 'Repair runtime audit directory permissions and ensure audit JSONL can be appended/read.');
  }
}

async function checkBudgetPolicy(options = {}) {
  try {
    const policy = loadBudgetPolicy(options);
    const scopes = policy.scopes || {};
    const hasScope = ['task', 'session'].some((scope) => isPlainObject(scopes[scope]) && Object.keys(scopes[scope]).length > 0);
    if (!policy.enabled || !hasScope) {
      return fail('budget.policy', 'Advisor budget policy is disabled or missing task/session caps.', 'Set advisorMode.budget.enabled and task/session advisorCalls, advisorTokens, and advisorLatencyMs caps in policy.example.json.');
    }
    return pass('budget.policy', 'Advisor budget policy loads with task/session caps.');
  } catch (error) {
    return fail('budget.policy', `Advisor budget policy failed to load: ${safeErrorMessage(error)}`, 'Restore valid advisorMode.budget policy JSON with task/session caps.');
  }
}

async function checkRecoveryMode(options = {}) {
  const root = getRoot(options);
  try {
    const mode = readOperatorMode(root, options);
    if (!['enforce', 'warning-only', 'disabled'].includes(mode.mode)) {
      return fail('recovery.mode', `Unknown operator recovery mode: ${mode.mode}`, 'Set .planning/config.json hooks advisor_mode/advisor_mode_strict to enforce, warning-only, or disabled semantics.');
    }
    return pass('recovery.mode', `Operator recovery mode is ${mode.mode}.`);
  } catch (error) {
    return fail('recovery.mode', `Operator recovery mode failed to load: ${safeErrorMessage(error)}`, 'Restore valid .planning/config.json hooks advisor mode flags.');
  }
}

const CHECK_RUNNERS = {
  'install.assets': checkInstallAssets,
  'hooks.wiring': checkHooksWiring,
  'advisor.permissions': checkAdvisorPermissions,
  'provider.routes': checkProviderRoutes,
  'provider.conformance': checkProviderConformance,
  'runtime.paths': checkRuntimePaths,
  'audit.raw_stream': checkAuditRawStream,
  'budget.policy': checkBudgetPolicy,
  'recovery.mode': checkRecoveryMode,
};

async function runDoctorCheck(checkId, options = {}) {
  const runner = CHECK_RUNNERS[checkId];
  if (!runner) return fail(checkId, `Unknown doctor check: ${checkId}`, 'Use one of the documented Advisor Mode doctor check IDs.');
  const result = await runner(options);
  return sanitizeAuditEvent(result);
}

function buildDoctorArtifact(results, options = {}) {
  const checks = results.map((result) => sanitizeAuditEvent(result));
  return {
    artifact_type: 'advisor-mode-doctor',
    event: 'doctor.completed',
    checked_at: options.now || new Date().toISOString(),
    status: checks.every((check) => check.status === 'pass') ? 'pass' : 'fail',
    smoke_enabled: options.smoke === true,
    offline_default: options.smoke !== true,
    checks,
  };
}

async function runDoctor(options = {}) {
  const root = getRoot(options);
  const checkIds = Array.isArray(options.checkIds) && options.checkIds.length > 0 ? options.checkIds : CHECK_IDS;
  const results = [];
  for (const checkId of checkIds) results.push(await runDoctorCheck(checkId, { ...options, root }));
  const artifact = buildDoctorArtifact(results, options);
  const sanitized = sanitizeAuditEvent(artifact);
  const statePath = runtimePath(root, ['state', 'doctor.json'], options);
  writeJson(statePath, sanitized);
  appendAuditEvent({ event: 'doctor.completed', status: sanitized.status, checks: sanitized.checks.map((check) => ({ id: check.id, status: check.status })) }, { ...options, root });
  return sanitized;
}

function parseArgs(argv = []) {
  const userArgs = path.basename(argv[1] || '') === 'doctor.js' ? argv.slice(2) : argv;
  const options = { json: false, pretty: false, smoke: false };
  for (let index = 0; index < userArgs.length; index += 1) {
    const arg = userArgs[index];
    if (arg === '--root') options.root = userArgs[++index];
    else if (arg === '--runtime-root') options.runtimeRoot = userArgs[++index];
    else if (arg === '--json') options.json = true;
    else if (arg === '--pretty') options.pretty = true;
    else if (arg === '--smoke') options.smoke = true;
  }
  return options;
}

async function main(argv = process.argv, io = { stdout: process.stdout, stderr: process.stderr }) {
  try {
    const options = parseArgs(argv);
    const artifact = await runDoctor(options);
    const output = options.pretty ? JSON.stringify(artifact, null, 2) : JSON.stringify(artifact);
    io.stdout.write(`${output}\n`);
    return artifact.status === 'pass' ? 0 : 1;
  } catch (error) {
    io.stderr.write(`${safeErrorMessage(error)}\n`);
    return 1;
  }
}

if (require.main === module) {
  main(process.argv).then((code) => { process.exitCode = code; });
}

module.exports = {
  runDoctor,
  runDoctorCheck,
  buildDoctorArtifact,
  main,
};
