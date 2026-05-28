const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const routeExamplePath = path.join(repoRoot, '.claude/advisor-mode/provider-routes.example.json');
const settingsPath = path.join(repoRoot, '.claude/settings.json');
const policy = JSON.parse(fs.readFileSync(path.join(repoRoot, '.claude/advisor-mode/policy.example.json'), 'utf8'));

const {
  validateRouteConfig,
  resolveRoute,
  buildResolvedRouteAuditEvent,
} = require('../provider-routing.js');
const {
  classifyPathClass,
  evaluateGatePolicy,
  buildRuntimeRouteMetadata,
} = require('../../hooks/advisor-gate.js');
const {
  recordExecutorRouteResolution,
} = require('../../hooks/executor-route-audit.js');

function makeTempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-mode-provider-routing-'));
  fs.mkdirSync(path.join(root, '.planning'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.planning', 'config.json'),
    JSON.stringify({ hooks: { advisor_mode: true, advisor_mode_strict: false } }, null, 2) + '\n',
  );
  fs.mkdirSync(path.join(root, '.claude', 'advisor-mode'), { recursive: true });
  fs.copyFileSync(routeExamplePath, path.join(root, '.claude/advisor-mode/provider-routes.example.json'));
  return root;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertNoSecrets(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /sk-[A-Za-z0-9]/i);
  assert.doesNotMatch(serialized, /bearer\s+[A-Za-z0-9._-]+/i);
  assert.doesNotMatch(serialized, /authorization/i);
  assert.doesNotMatch(serialized, /headers/i);
  assert.doesNotMatch(serialized, /requestBody|body|prompt|response/i);
  assert.doesNotMatch(serialized, /ANTHROPIC_AUTH_TOKEN_VALUE/);
}

test('ROUT-01 provider-routes.example.json declares schemaVersion 1 and semantic aliases', () => {
  const config = readJson(routeExamplePath);
  assert.equal(config.schemaVersion, 1);
  assert.deepEqual(Object.keys(config.routes).sort(), ['haiku', 'opus', 'sonnet']);
});

test('ROUT-01 route validation rejects strict schema, unsupported conformance, and literal secrets', () => {
  const valid = readJson(routeExamplePath);
  assert.equal(validateRouteConfig(valid).ok, true);

  const withUnknownTopLevel = { ...valid, unexpected: true };
  assert.equal(validateRouteConfig(withUnknownTopLevel).ok, false);
  assert.match(validateRouteConfig(withUnknownTopLevel).errors.join('\n'), /unexpected field: unexpected/);

  const missingProvider = JSON.parse(JSON.stringify(valid));
  delete missingProvider.routes.sonnet.provider;
  assert.equal(validateRouteConfig(missingProvider).ok, false);
  assert.match(validateRouteConfig(missingProvider).errors.join('\n'), /routes\.sonnet\.provider/);

  const unsupportedConformance = JSON.parse(JSON.stringify(valid));
  unsupportedConformance.routes.sonnet.requiredConformance = ['made-up-check'];
  assert.equal(validateRouteConfig(unsupportedConformance).ok, false);
  assert.match(validateRouteConfig(unsupportedConformance).errors.join('\n'), /unsupported conformance/);

  const literalSecret = JSON.parse(JSON.stringify(valid));
  literalSecret.routes.sonnet.credentialEnv = 'sk-ANTHROPIC_AUTH_TOKEN_VALUE';
  assert.equal(validateRouteConfig(literalSecret).ok, false);
  assert.match(validateRouteConfig(literalSecret).errors.join('\n'), /literal secret/);
});

test('ROUT-01 resolveRoute maps aliases and returns missing-route without fallback', () => {
  const config = readJson(routeExamplePath);
  const sonnet = resolveRoute(config, 'sonnet', { routeConfigPath: routeExamplePath });
  assert.equal(sonnet.ok, true);
  assert.equal(sonnet.alias, 'sonnet');
  assert.equal(sonnet.provider, config.routes.sonnet.provider);
  assert.equal(sonnet.model, config.routes.sonnet.model);
  assert.equal(sonnet.endpointRef, config.routes.sonnet.endpointRef);
  assert.deepEqual(sonnet.requiredConformance, config.routes.sonnet.requiredConformance);

  const absent = resolveRoute(config, 'missing-alias');
  assert.equal(absent.ok, false);
  assert.equal(absent.reasonCode, 'missing-route');
  assert.equal(absent.provider, undefined);
  assert.equal(absent.model, undefined);
});

test('ROUT-04 workflow modules stay declarative and do not embed concrete GLM or GPT-5.5 IDs', () => {
  const config = readJson(routeExamplePath);
  assert.match(config.routes.sonnet.model, /glm/i);
  assert.match(config.routes.opus.model, /gpt/i);

  const advisorGateSource = fs.readFileSync(path.join(repoRoot, '.claude/hooks/advisor-gate.js'), 'utf8');
  assert.doesNotMatch(advisorGateSource, new RegExp(config.routes.sonnet.model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(advisorGateSource, new RegExp(config.routes.opus.model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('ROUT-02 buildResolvedRouteAuditEvent includes resolved metadata and excludes secrets', () => {
  const config = readJson(routeExamplePath);
  const resolution = resolveRoute(config, 'opus', { routeConfigPath: routeExamplePath });
  const event = buildResolvedRouteAuditEvent(resolution, {
    headers: { authorization: 'Bearer sk-secret' },
    requestBody: { prompt: 'secret prompt' },
    credentialValue: 'ANTHROPIC_AUTH_TOKEN_VALUE',
  });

  assert.equal(event.event, 'provider_route.resolved');
  assert.equal(event.requestedAlias, 'opus');
  assert.equal(event.resolvedProvider, config.routes.opus.provider);
  assert.equal(event.resolvedModel, config.routes.opus.model);
  assert.equal(event.endpointRef, config.routes.opus.endpointRef);
  assert.ok(event.routeConfigPath.endsWith('provider-routes.example.json'));
  assert.equal(event.conformanceStatus, 'unchecked');
  assertNoSecrets(event);
});

test('ROUT-01 provider-routes protected surface covers example and local override files', () => {
  assert.equal(classifyPathClass('Edit', { file_path: '.claude/advisor-mode/provider-routes.example.json' }, policy), 'provider-routes');
  assert.equal(classifyPathClass('Edit', { file_path: '.claude/advisor-mode/provider-routes.json' }, policy), 'provider-routes');
});

test('ROUT-02 buildRuntimeRouteMetadata resolves advisor alias opus without secrets', () => {
  const root = makeTempRoot();
  const metadata = buildRuntimeRouteMetadata({ requestedAlias: 'opus' }, { root });

  assert.equal(metadata.ok, true);
  assert.equal(metadata.requestedAlias, 'opus');
  assert.equal(metadata.resolvedProvider, 'openrouter');
  assert.match(metadata.resolvedModel, /gpt/i);
  assert.equal(metadata.endpointRef, 'openrouter-anthropic');
  assert.ok(metadata.routeConfigPath.endsWith('provider-routes.example.json'));
  assert.equal(metadata.conformanceStatus, 'unchecked');
  assertNoSecrets(metadata);
});

test('ROUT-02 evaluateGatePolicy writes advisor consultation request with routeResolution by default', () => {
  const root = makeTempRoot();
  const result = evaluateGatePolicy(
    { toolName: 'Edit', toolInput: { file_path: '.claude/advisor-mode/provider-routes.example.json' } },
    { root, policy },
  );

  assert.equal(result.gateAction, 'advisory');
  const request = readJson(result.requestPath);
  assert.equal(request.routeResolution.requestedAlias, 'opus');
  assert.equal(request.routeResolution.resolvedProvider, 'openrouter');
  assert.match(request.routeResolution.resolvedModel, /gpt/i);
  assertNoSecrets(request.routeResolution);
});

test('ROUT-02 executor runtime hook records sanitized sonnet route artifact and JSONL audit event', () => {
  const root = makeTempRoot();
  const result = recordExecutorRouteResolution(
    {
      hookEventName: 'PostToolUse',
      session_id: 'session-123',
      transcript_path: '/tmp/transcript.jsonl',
      prompt: 'do not record this',
      response: 'do not record this',
      headers: { authorization: 'Bearer sk-secret' },
      requestBody: { body: 'do not record this' },
    },
    { root, now: '2026-05-28T00:00:00.000Z' },
  );

  assert.equal(result.ok, true);
  assert.equal(result.event, 'provider_route.executor_call');
  assert.equal(result.requestedAlias, 'sonnet');
  assert.equal(result.resolvedProvider, 'openrouter');
  assert.match(result.resolvedModel, /glm/i);
  assert.ok(fs.existsSync(result.artifactPath));
  const artifact = readJson(result.artifactPath);
  assert.equal(artifact.event, 'provider_route.executor_call');
  assert.equal(artifact.runtimeCorrelationId, 'session-123');
  assertNoSecrets(artifact);

  const auditLines = fs.readFileSync(path.join(root, '.advisor/audit/events.jsonl'), 'utf8').trim().split('\n');
  assert.equal(auditLines.length, 1);
  const auditEvent = JSON.parse(auditLines[0]);
  assert.equal(auditEvent.event, 'provider_route.executor_call');
  assert.equal(auditEvent.requestedAlias, 'sonnet');
  assertNoSecrets(auditEvent);
});

test('ROUT-02 settings register executor-route-audit.js on executor runtime hook surface', () => {
  const settings = readJson(settingsPath);
  const postToolUse = settings.hooks && settings.hooks.PostToolUse;
  assert.ok(Array.isArray(postToolUse));
  const commands = JSON.stringify(postToolUse);
  assert.match(commands, /executor-route-audit\.js/);
  assert.match(commands, /Bash\|Edit\|Write\|MultiEdit\|Agent\|Task/);
});
