#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { runtimePath } = require('../advisor-mode/runtime-paths.js');
const {
  loadRouteConfig,
  resolveRoute,
} = require('../advisor-mode/provider-routing.js');

function getRoot(options = {}) {
  return options.root || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function routeConfigPath(root) {
  const localPath = path.join(root, '.claude', 'advisor-mode', 'provider-routes.json');
  return fs.existsSync(localPath) ? localPath : path.join(root, '.claude', 'advisor-mode', 'provider-routes.example.json');
}

function runtimeCorrelationId(input = {}) {
  if (typeof input.session_id === 'string' && input.session_id.length > 0) return input.session_id;
  if (typeof input.sessionId === 'string' && input.sessionId.length > 0) return input.sessionId;
  if (typeof input.correlationKey === 'string' && input.correlationKey.length > 0) return input.correlationKey;
  const material = JSON.stringify({ hookEventName: input.hookEventName, transcript_path: input.transcript_path || input.transcriptPath || '' });
  return `executor-route-${crypto.createHash('sha256').update(material).digest('hex').slice(0, 16)}`;
}

function buildExecutorRouteAuditEvent(input = {}, options = {}) {
  const root = getRoot(options);
  const requestedAlias = input.requestedAlias || 'sonnet';
  const configPath = options.routeConfigPath || routeConfigPath(root);
  const loaded = loadRouteConfig(configPath, { root });
  const base = {
    event: 'provider_route.executor_call',
    requestedAlias,
    routeConfigPath: configPath,
    recordedAt: options.now || new Date().toISOString(),
    runtimeCorrelationId: runtimeCorrelationId(input),
  };
  if (!loaded.ok) {
    return {
      ...base,
      ok: false,
      conformanceStatus: 'unknown',
      reasonCode: 'route-config-load-failed',
      errors: loaded.errors,
    };
  }
  const resolution = resolveRoute(loaded.config, requestedAlias, { routeConfigPath: configPath });
  if (!resolution.ok) {
    return {
      ...base,
      ok: false,
      conformanceStatus: 'unknown',
      reasonCode: resolution.reasonCode,
      errors: resolution.errors,
    };
  }
  return {
    ...base,
    ok: true,
    resolvedProvider: resolution.provider,
    resolvedModel: resolution.model,
    endpointRef: resolution.endpointRef,
    conformanceStatus: resolution.conformanceStatus || 'unchecked',
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function recordExecutorRouteResolution(input = {}, options = {}) {
  const root = getRoot(options);
  const event = buildExecutorRouteAuditEvent(input, options);
  const safeId = event.runtimeCorrelationId.replace(/[^A-Za-z0-9._-]/g, '-');
  const artifactPath = options.artifactPath || runtimePath(root, ['runtime', 'executor-calls', `${safeId}.json`], options);
  const auditPath = options.auditPath || runtimePath(root, ['audit', 'events.jsonl'], options);
  writeJson(artifactPath, event);
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.appendFileSync(auditPath, `${JSON.stringify(event)}\n`);
  return { ...event, artifactPath, auditPath };
}

function parseInput(input) {
  try {
    return input ? JSON.parse(input) : {};
  } catch {
    return {};
  }
}

function main() {
  let input = '';
  const stdinTimeout = setTimeout(() => process.exit(0), 3000);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    input += chunk;
  });
  process.stdin.on('end', () => {
    clearTimeout(stdinTimeout);
    try {
      const event = parseInput(input);
      recordExecutorRouteResolution(event);
    } catch {
      process.exitCode = 0;
    }
  });
}

if (require.main === module) main();

module.exports = {
  buildExecutorRouteAuditEvent,
  recordExecutorRouteResolution,
  main,
};
