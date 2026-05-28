const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const conformancePath = path.join(repoRoot, '.claude/advisor-mode/provider-conformance.js');
const routeExamplePath = path.join(repoRoot, '.claude/advisor-mode/provider-routes.example.json');

const {
  createLiveGatewayClient,
  runConformance,
  runSingleConformanceCheck,
  buildConformanceArtifact,
  validateConformanceArtifact,
  writeConformanceArtifacts,
} = require('../provider-conformance.js');

function makeTempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-mode-provider-conformance-'));
  fs.mkdirSync(path.join(root, '.claude', 'advisor-mode'), { recursive: true });
  fs.copyFileSync(routeExamplePath, path.join(root, '.claude/advisor-mode/provider-routes.example.json'));
  return root;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function createLiveMessage(model, overrides = {}) {
  return {
    id: 'msg_live',
    type: 'message',
    role: 'assistant',
    model,
    content: [{ type: 'text', text: 'ok' }],
    usage: { input_tokens: 2, output_tokens: 1 },
    ...overrides,
  };
}

function createJsonResponse(body, options = {}) {
  const status = options.status || 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map(Object.entries(options.headers || {})),
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

function createStreamingResponse(events) {
  const chunks = events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  return {
    ok: true,
    status: 200,
    headers: new Map([['content-type', 'text/event-stream']]),
    body: {
      async *[Symbol.asyncIterator]() {
        const encoder = new TextEncoder();
        for (const chunk of chunks) yield encoder.encode(chunk);
      },
    },
    async text() {
      return chunks.join('');
    },
  };
}

function createLiveFetchRecorder(options = {}) {
  const calls = [];
  const servedModel = options.servedModel || 'provider/served-model';
  const fetchImpl = async (url, request = {}) => {
    const parsedBody = JSON.parse(request.body || '{}');
    calls.push({ url, request, body: parsedBody });
    if (parsedBody.stream) {
      return createStreamingResponse([
        { type: 'message_start', message: { id: 'msg_stream', model: servedModel } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } },
        { type: 'message_stop' },
      ]);
    }
    if (parsedBody.model === '__advisor_mode_invalid_model__') {
      return createJsonResponse({ error: { type: 'invalid_request_error', message: 'invalid model' } }, { status: 400 });
    }
    if (Array.isArray(parsedBody.tools) && parsedBody.tools.length > 0) {
      return createJsonResponse(createLiveMessage(servedModel, { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'toolu_live', name: 'advisor_echo', input: { value: 'ok' } }] }));
    }
    return createJsonResponse(createLiveMessage(servedModel));
  };
  return { calls, fetchImpl };
}

function assertNoSecrets(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /sk-[A-Za-z0-9]/i);
  assert.doesNotMatch(serialized, /bearer\s+[A-Za-z0-9._-]+/i);
  assert.doesNotMatch(serialized, /authorization/i);
  assert.doesNotMatch(serialized, /headers/i);
  assert.doesNotMatch(serialized, /requestBody|body|prompt|messages/i);
  assert.doesNotMatch(serialized, /TOKEN_PLACEHOLDER/);
}

function createPassingClient() {
  return {
    async baseMessage(route) {
      return { id: 'msg-1', type: 'message', model: route.model, role: 'assistant', content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 3, output_tokens: 2 } };
    },
    async stream(route) {
      return [
        { type: 'message_start', message: { id: 'msg-stream', model: route.model } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 2 } },
        { type: 'message_stop' },
      ];
    },
    async toolUse(route) {
      return { id: 'msg-tool', model: route.model, stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'toolu_1', name: 'advisor_echo', input: { value: 'ok' } }], usage: { input_tokens: 5, output_tokens: 4 } };
    },
    async usage(route) {
      return { id: 'msg-usage', model: route.model, content: [{ type: 'text', text: 'usage' }], usage: { input_tokens: 6, output_tokens: 7 } };
    },
    async errorShape() {
      const error = new Error('synthetic provider error');
      error.status = 401;
      error.response = { error: { type: 'authentication_error', message: 'invalid token' } };
      throw error;
    },
  };
}

test('ROUT-03 createLiveGatewayClient requires ANTHROPIC_BASE_URL without exposing token values', () => {
  assert.equal(typeof createLiveGatewayClient, 'function');
  assert.throws(
    () => createLiveGatewayClient({ env: { ANTHROPIC_AUTH_TOKEN: 'TEST_TOKEN_PLACEHOLDER' }, fetchImpl: async () => {} }),
    (error) => {
      assert.match(error.message, /ANTHROPIC_BASE_URL/);
      assert.doesNotMatch(error.message, /TEST_TOKEN_PLACEHOLDER/);
      return true;
    },
  );
});

test('ROUT-03 live gateway client sends Anthropic-compatible message requests with route model and safe headers', async () => {
  const { calls, fetchImpl } = createLiveFetchRecorder();
  const client = createLiveGatewayClient({
    env: { ANTHROPIC_BASE_URL: 'https://gateway.example/api/', ANTHROPIC_AUTH_TOKEN: 'TEST_TOKEN_PLACEHOLDER' },
    fetchImpl,
  });

  const message = await client.baseMessage({ model: 'configured/model' });

  assert.equal(message.model, 'provider/served-model');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://gateway.example/api/v1/messages');
  assert.equal(calls[0].request.method, 'POST');
  assert.equal(calls[0].request.headers.authorization, 'Bearer TEST_TOKEN_PLACEHOLDER');
  assert.equal(calls[0].request.headers['anthropic-version'], '2023-06-01');
  assert.equal(calls[0].request.headers['content-type'], 'application/json');
  assert.equal(calls[0].body.model, 'configured/model');
  assert.equal(calls[0].body.max_tokens, 64);
});

test('ROUT-03 runConformance live mode uses mocked fetch for all required checks and separates configuredRoute from servedRoute', async () => {
  const root = makeTempRoot();
  const { calls, fetchImpl } = createLiveFetchRecorder({ servedModel: 'provider/actual-served-model' });
  const result = await runConformance(
    { aliases: ['opus'], live: true },
    {
      root,
      fetchImpl,
      env: { ANTHROPIC_BASE_URL: 'https://gateway.example/api', ANTHROPIC_AUTH_TOKEN: 'TEST_TOKEN_PLACEHOLDER' },
      now: '2026-05-28T00:00:00.000Z',
    },
  );
  const artifact = buildConformanceArtifact(result);

  assert.equal(result.status, 'pass');
  assert.equal(calls.length, 5);
  assert.deepEqual(result.routes[0].checks.map((check) => check.name), ['base-message', 'streaming', 'tool-use', 'usage-fields', 'error-shape']);
  assert.equal(artifact.routes[0].configuredRoute.model, result.routes[0].resolvedModel);
  assert.equal(artifact.routes[0].servedRoute.model, 'provider/actual-served-model');
  assert.equal(artifact.routes[0].servedRoute.observed, true);
  assertNoSecrets(artifact);
});

test('ROUT-03 live CLI fails closed when gateway returns malformed Anthropic response shape', () => {
  const root = makeTempRoot();
  const fetchMockPath = path.join(root, 'malformed-live-fetch.js');
  fs.writeFileSync(fetchMockPath, `
    global.fetch = async function () {
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        async json() { return { type: 'not-message', content: [] }; },
        async text() { return '{"type":"not-message","content":[]}'; }
      };
    };
  `);

  const cli = spawnSync(process.execPath, ['--require', fetchMockPath, conformancePath, '--root', root, '--alias', 'opus', '--live'], {
    encoding: 'utf8',
    timeout: 2000,
    env: {
      ...process.env,
      ANTHROPIC_BASE_URL: 'https://gateway.example/api',
      ANTHROPIC_AUTH_TOKEN: 'TEST_TOKEN_PLACEHOLDER',
    },
  });

  assert.notEqual(cli.status, 0);
  assert.doesNotMatch(cli.stdout, /TEST_TOKEN_PLACEHOLDER/);
  assert.doesNotMatch(cli.stderr, /TEST_TOKEN_PLACEHOLDER/);
  assertNoSecrets(readJson(path.join(root, '.advisor/state/provider-conformance.json')));
});

test('ROUT-03 runConformance resolves aliases and runs exactly required advisor-critical checks', async () => {
  const root = makeTempRoot();
  const result = await runConformance({ aliases: ['opus'], configPath: path.join(root, '.claude/advisor-mode/provider-routes.example.json') }, { root, client: createPassingClient(), now: '2026-05-28T00:00:00.000Z' });

  assert.equal(result.status, 'pass');
  assert.equal(result.routes.length, 1);
  assert.equal(result.routes[0].requestedAlias, 'opus');
  assert.equal(result.routes[0].resolvedProvider, 'openrouter');
  assert.match(result.routes[0].resolvedModel, /gpt/i);
  assert.deepEqual(result.routes[0].checks.map((check) => check.name), ['base-message', 'streaming', 'tool-use', 'usage-fields', 'error-shape']);
});

test('ROUT-03 mocked base streaming tool usage and error responses produce pass evidence', async () => {
  const root = makeTempRoot();
  const result = await runConformance({ aliases: ['sonnet'] }, { root, client: createPassingClient(), now: '2026-05-28T00:00:00.000Z' });

  assert.equal(result.status, 'pass');
  for (const check of result.routes[0].checks) {
    assert.equal(check.status, 'pass', check.name);
    assert.equal(typeof check.evidence, 'object');
  }
  assertNoSecrets(result);
});

test('ROUT-03 malformed usage stream tool or error shape fails conformance and CLI exits non-zero', async () => {
  const root = makeTempRoot();
  const badClient = {
    ...createPassingClient(),
    async stream() { return [{ type: 'unexpected_event' }]; },
    async toolUse() { return { content: [{ type: 'text', text: 'no tool' }], usage: { input_tokens: 1, output_tokens: 1 } }; },
    async usage() { return { usage: { input_tokens: 1 } }; },
    async errorShape() { throw new Error('plain error'); },
  };
  const result = await runConformance({ aliases: ['opus'] }, { root, client: badClient, now: '2026-05-28T00:00:00.000Z' });

  assert.equal(result.status, 'fail');
  assert.ok(result.routes[0].checks.some((check) => check.name === 'streaming' && check.status === 'fail'));
  assert.ok(result.routes[0].checks.some((check) => check.name === 'tool-use' && check.status === 'fail'));
  assert.ok(result.routes[0].checks.some((check) => check.name === 'usage-fields' && check.status === 'fail'));
  assert.ok(result.routes[0].checks.some((check) => check.name === 'error-shape' && check.status === 'fail'));

  const cli = spawnSync(process.execPath, [conformancePath, '--root', root, '--alias', 'opus', '--mock', 'fail'], { encoding: 'utf8', timeout: 2000 });
  assert.notEqual(cli.status, 0);
});

test('ROUT-02 conformance artifact records resolved metadata and rejects secret leakage', async () => {
  const root = makeTempRoot();
  const result = await runConformance(
    { aliases: ['opus'], headers: { authorization: 'Bearer TEST_TOKEN_PLACEHOLDER' }, requestBody: { messages: ['secret'] }, credentialValue: 'TEST_TOKEN_PLACEHOLDER' },
    { root, client: createPassingClient(), now: '2026-05-28T00:00:00.000Z' },
  );
  const artifact = buildConformanceArtifact(result);
  const validation = validateConformanceArtifact(artifact);

  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.equal(artifact.artifact_type, 'provider-conformance');
  assert.equal(artifact.event, 'provider_conformance.completed');
  assert.equal(artifact.routes[0].requestedAlias, 'opus');
  assert.equal(artifact.routes[0].resolvedProvider, 'openrouter');
  assert.match(artifact.routes[0].resolvedModel, /gpt/i);
  assert.equal(artifact.routes[0].endpointRef, 'openrouter-anthropic');
  assert.equal(artifact.routes[0].checkedAt, '2026-05-28T00:00:00.000Z');
  assertNoSecrets(artifact);
});

test('ROUT-02 writeConformanceArtifacts writes state and appends provider_conformance.completed audit JSONL', async () => {
  const root = makeTempRoot();
  const result = await runConformance({ aliases: ['sonnet'] }, { root, client: createPassingClient(), now: '2026-05-28T00:00:00.000Z' });
  const artifact = buildConformanceArtifact(result);
  const paths = writeConformanceArtifacts(artifact, { root });

  assert.equal(paths.statePath, path.join(root, '.advisor/state/provider-conformance.json'));
  assert.equal(paths.auditPath, path.join(root, '.advisor/audit/events.jsonl'));
  assert.equal(readJson(paths.statePath).event, 'provider_conformance.completed');
  const auditLines = fs.readFileSync(paths.auditPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(auditLines.length, 1);
  assert.equal(auditLines[0].event, 'provider_conformance.completed');
  assert.equal(auditLines[0].status, 'pass');
  assert.equal(auditLines[0].routes[0].requestedAlias, 'sonnet');
  assertNoSecrets(auditLines[0]);
});

test('ROUT-03 runSingleConformanceCheck fails unsupported checks instead of falling back silently', async () => {
  const check = await runSingleConformanceCheck('unknown-check', { alias: 'opus' }, createPassingClient());
  assert.equal(check.status, 'fail');
  assert.match(check.evidence.reason, /unsupported/i);
});
