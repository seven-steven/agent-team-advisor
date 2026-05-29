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
  assertServedRouteSourceAvailable,
  normalizeServedRoute,
} = require('../provider-routing.js');
const {
  classifyPathClass,
  evaluateGatePolicy,
  buildRuntimeRouteMetadata,
  buildRequest,
} = require('../../hooks/advisor-gate.js');
const {
  recordExecutorRouteResolution,
  buildExecutorRouteAuditEvent,
} = require('../../hooks/executor-route-audit.js');

const ADVISOR_OBSERVED_MODEL_SOURCE = 'advisorRecommendation.providerResponse.body.model';
const EXECUTOR_OBSERVED_MODEL_SOURCE = 'hookEvent.providerResponse.body.model';

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
  assert.doesNotMatch(serialized, /requestBody|prompt|rawResponse/i);
  assert.doesNotMatch(serialized, /ANTHROPIC_AUTH_TOKEN_VALUE/);
}

test('ROUT-02 rejects static route data as observed-model source-of-truth', () => {
  const config = readJson(routeExamplePath);
  const resolution = resolveRoute(config, 'opus', { routeConfigPath: routeExamplePath });
  const invalidSources = [
    ['configuredRoute', { provider: resolution.provider, model: resolution.model }],
    ['resolvedRoute', resolution],
    ['requestedAlias', { requestedAlias: 'opus' }],
    ['routeConfig.routes.opus', config.routes.opus],
    ['provider-routes.example.json.routes.opus', config.routes.opus],
  ];

  for (const [source, input] of invalidSources) {
    const result = assertServedRouteSourceAvailable(source, input);
    assert.equal(result.ok, false, source);
    assert.equal(result.reasonCode, 'invalid-served-route-source');
  }
});

test('ROUT-02 accepts advisor runtime response.body.model as observed-model source', () => {
  const result = assertServedRouteSourceAvailable(ADVISOR_OBSERVED_MODEL_SOURCE, {
    body: { id: 'msg_advisor_123', model: 'openai/gpt-5.5' },
    headers: { 'x-oneapi-request-id': 'req_advisor_123' },
  });

  assert.equal(result.ok, true);
  assert.equal(result.servedRoute.sourceField, ADVISOR_OBSERVED_MODEL_SOURCE);
  assert.equal(result.servedRoute.observedModel, 'openai/gpt-5.5');
  assert.equal(result.servedRoute.responseId, 'msg_advisor_123');
});

test('ROUT-02 accepts executor runtime response.body.model as observed-model source', () => {
  const result = assertServedRouteSourceAvailable(EXECUTOR_OBSERVED_MODEL_SOURCE, {
    body: { id: 'msg_executor_123', model: 'z_ai/glm-5.1' },
  });

  assert.equal(result.ok, true);
  assert.equal(result.servedRoute.sourceField, EXECUTOR_OBSERVED_MODEL_SOURCE);
  assert.equal(result.servedRoute.observedModel, 'z_ai/glm-5.1');
  assert.equal(result.servedRoute.responseId, 'msg_executor_123');
});

test('ROUT-02 normalizeServedRoute emits observedModel only from runtime response metadata', () => {
  const observedRoute = normalizeServedRoute(
    { body: { id: 'msg_123', model: 'provider/actual-model' } },
    { source: 'provider-response', sourceField: ADVISOR_OBSERVED_MODEL_SOURCE, providerAlias: 'OpenRouter', endpointAlias: 'openrouter-anthropic' },
  );

  assert.deepEqual(observedRoute, {
    observed: true,
    observedModel: 'provider/actual-model',
    source: 'provider-response',
    sourceField: ADVISOR_OBSERVED_MODEL_SOURCE,
    responseId: 'msg_123',
    providerAlias: 'OpenRouter',
    endpointAlias: 'openrouter-anthropic',
  });
  assert.equal(normalizeServedRoute({ requestedAlias: 'opus' }, { source: 'requestedAlias' }).observed, false);
});

test('ROUT-02 buildRequest includes observedModel only when advisor response metadata exists', () => {
  const root = makeTempRoot();
  const event = { toolName: 'Edit', requestedAlias: 'opus' };
  const classes = { toolClass: 'mutation', actionClass: 'governance-configuration', pathClass: 'provider-routes' };
  const rule = { id: 'provider-route-change', risk: 'high', triggerReason: 'route change' };
  const paths = { correlationKey: 'advisor-consultation-test', requestPath: '/tmp/request.json', recommendationPath: '/tmp/recommendation.json' };

  const withoutResponse = buildRequest(event, classes, rule, paths, { root });
  assert.equal(withoutResponse.observedRoute.observed, false);
  assert.equal(withoutResponse.observedModel, undefined);

  const withResponse = buildRequest(event, classes, rule, paths, {
    root,
    advisorRecommendation: {
      providerResponse: {
        body: { id: 'msg_advisor_321', model: 'openai/gpt-5.5' },
        headers: { 'x-oneapi-request-id': 'req_advisor_321' },
      },
    },
  });
  assert.equal(withResponse.routeResolution.configuredProvider, 'openrouter');
  assert.equal(withResponse.routeResolution.configuredModel, 'openai/gpt-5.5');
  assert.equal(withResponse.observedRoute.observed, true);
  assert.equal(withResponse.observedRoute.observedModel, 'openai/gpt-5.5');
  assert.equal(withResponse.observedRoute.sourceField, ADVISOR_OBSERVED_MODEL_SOURCE);
  assertNoSecrets(withResponse);
});

test('ROUT-02 executor audit writes observedModel only from hookEvent provider response metadata', () => {
  const root = makeTempRoot();
  const withoutResponse = buildExecutorRouteAuditEvent(
    { hookEventName: 'PostToolUse', session_id: 'session-unobserved' },
    { root, runtimeRoot: path.join(root, '.advisor'), now: '2026-05-28T00:00:00.000Z' },
  );
  assert.equal(withoutResponse.observedRoute.observed, false);
  assert.equal(withoutResponse.observedModel, null);

  const result = recordExecutorRouteResolution(
    {
      hookEventName: 'PostToolUse',
      session_id: 'session-observed',
      providerResponse: {
        body: { id: 'msg_executor_456', model: 'z_ai/glm-5.1' },
        headers: { 'x-oneapi-request-id': 'req_executor_456' },
      },
      headers: { authorization: 'Bearer sk-secret' },
      requestBody: { prompt: 'do not record this' },
    },
    { root, runtimeRoot: path.join(root, '.advisor'), now: '2026-05-28T00:00:00.000Z' },
  );

  assert.equal(result.configuredProvider, 'openrouter');
  assert.equal(result.configuredModel, 'z-ai/glm-4.5');
  assert.equal(result.observedModel, 'z_ai/glm-5.1');
  assert.equal(result.observedRoute.sourceField, EXECUTOR_OBSERVED_MODEL_SOURCE);
  const artifact = readJson(result.artifactPath);
  assert.equal(artifact.observedModel, 'z_ai/glm-5.1');
  const auditEvent = JSON.parse(fs.readFileSync(result.auditPath, 'utf8').trim().split('\n').at(-1));
  assert.equal(auditEvent.observedRoute.sourceField, EXECUTOR_OBSERVED_MODEL_SOURCE);
  assertNoSecrets(auditEvent);
});

test('ROUT-02 configured model mismatch remains distinct from observedModel', () => {
  const config = readJson(routeExamplePath);
  const resolution = resolveRoute(config, 'opus', { routeConfigPath: routeExamplePath });
  const event = buildResolvedRouteAuditEvent(resolution, {
    servedRoute: normalizeServedRoute(
      { body: { id: 'msg_mismatch', model: 'openai/gpt-5.5-mini' } },
      { source: 'provider-response', sourceField: ADVISOR_OBSERVED_MODEL_SOURCE },
    ),
  });

  assert.equal(event.configuredModel, config.routes.opus.model);
  assert.equal(event.observedModel, 'openai/gpt-5.5-mini');
  assert.notEqual(event.configuredModel, event.observedModel);
});

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

test('ROUT-02 buildResolvedRouteAuditEvent includes configured route metadata and excludes secrets', () => {
  const config = readJson(routeExamplePath);
  const resolution = resolveRoute(config, 'opus', { routeConfigPath: routeExamplePath });
  const event = buildResolvedRouteAuditEvent(resolution, {
    headers: { authorization: 'Bearer sk-secret' },
    requestBody: { prompt: 'secret prompt' },
    credentialValue: 'ANTHROPIC_AUTH_TOKEN_VALUE',
  });

  assert.equal(event.event, 'provider_route.resolved');
  assert.equal(event.requestedAlias, 'opus');
  assert.equal(event.configuredProvider, config.routes.opus.provider);
  assert.equal(event.configuredModel, config.routes.opus.model);
  assert.equal(event.endpointAlias, config.routes.opus.endpointRef);
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
  assert.equal(metadata.configuredProvider, 'openrouter');
  assert.match(metadata.configuredModel, /gpt/i);
  assert.equal(metadata.endpointAlias, 'openrouter-anthropic');
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
  assert.equal(request.routeResolution.configuredProvider, 'openrouter');
  assert.equal(request.routeResolution.configuredModel, 'openai/gpt-5.5');
  assert.equal(request.routeResolution.endpointAlias, 'openrouter-anthropic');
  assert.equal(request.observedRoute.observed, false);
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
    { root, runtimeRoot: path.join(root, '.advisor'), now: '2026-05-28T00:00:00.000Z' },
  );

  assert.equal(result.ok, true);
  assert.equal(result.event, 'provider_route.executor_call');
  assert.equal(result.requestedAlias, 'sonnet');
  assert.equal(result.configuredProvider, 'openrouter');
  assert.match(result.configuredModel, /glm/i);
  assert.ok(fs.existsSync(result.artifactPath));
  const artifact = readJson(result.artifactPath);
  assert.equal(artifact.event, 'provider_route.executor_call');
  assert.equal(artifact.runtimeCorrelationId, 'session-123');
  assert.equal(artifact.observedModel, null);
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
