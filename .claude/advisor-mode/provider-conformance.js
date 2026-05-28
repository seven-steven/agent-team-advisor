#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { loadRouteConfig, resolveRoute } = require('./provider-routing.js');

const DEFAULT_STATE_FILE = ['.advisor', 'state', 'provider-conformance.json'];
const DEFAULT_AUDIT_FILE = ['.advisor', 'audit', 'events.jsonl'];
const REQUIRED_CHECKS = ['base-message', 'streaming', 'tool-use', 'usage-fields', 'error-shape'];
const ALLOWED_CHECKS = new Set(REQUIRED_CHECKS);
const SCHEMA_PATH = path.join(__dirname, 'provider-conformance.schema.json');

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

function getHeaderValue(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name) || headers.get(name.toLowerCase());
  return headers[name] || headers[name.toLowerCase()];
}

function normalizeMessagesEndpoint(baseUrl) {
  const normalized = String(baseUrl || '').replace(/\/+$/, '');
  if (normalized.endsWith('/messages')) return normalized;
  if (normalized.endsWith('/v1')) return `${normalized}/messages`;
  return `${normalized}/v1/messages`;
}

function extractServedRoute(response) {
  const model = response && (response.model || (response.message && response.message.model));
  const provider = response && (response.provider || response.provider_id || (response.metadata && (response.metadata.provider || response.metadata.provider_id)));
  if (typeof model === 'string' && model.length > 0) {
    const servedRoute = { observed: true, model };
    if (typeof provider === 'string' && provider.length > 0) servedRoute.provider = provider;
    return servedRoute;
  }
  return { observed: false, reasonCode: 'served-route-unavailable' };
}

function mergeServedRoute(current, next) {
  if (current && current.observed) return current;
  if (next && next.observed) return next;
  return current || next || { observed: false, reasonCode: 'served-route-unavailable' };
}

function createProviderError(response, body) {
  const message = body && body.error && typeof body.error.message === 'string' ? body.error.message : `provider returned HTTP ${response.status}`;
  const error = new Error(message);
  error.status = response.status;
  error.response = isPlainObject(body) ? body : { error: { type: 'http_error', message } };
  return error;
}

async function readJsonResponse(response) {
  if (typeof response.json === 'function') return response.json();
  if (typeof response.text === 'function') {
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }
  return {};
}

function decodeChunk(chunk) {
  if (typeof chunk === 'string') return chunk;
  if (chunk instanceof Uint8Array) return new TextDecoder().decode(chunk);
  if (Buffer.isBuffer(chunk)) return chunk.toString('utf8');
  return String(chunk || '');
}

async function readStreamingEvents(response) {
  const events = [];
  let text = '';
  if (response.body && typeof response.body[Symbol.asyncIterator] === 'function') {
    for await (const chunk of response.body) text += decodeChunk(chunk);
  } else if (typeof response.text === 'function') {
    text = await response.text();
  }
  for (const block of text.split(/\n\n+/)) {
    const dataLine = block.split(/\n/).find((line) => line.startsWith('data:'));
    if (!dataLine) continue;
    const data = dataLine.slice('data:'.length).trim();
    if (!data || data === '[DONE]') continue;
    try {
      events.push(JSON.parse(data));
    } catch {
      events.push({ type: 'malformed_event' });
    }
  }
  return events;
}

function createLiveGatewayClient(options = {}) {
  const env = options.env || process.env;
  const baseUrl = env.ANTHROPIC_BASE_URL;
  const token = env.ANTHROPIC_AUTH_TOKEN;
  if (!baseUrl) throw new Error('ANTHROPIC_BASE_URL is required for live provider conformance');
  if (!token) throw new Error('ANTHROPIC_AUTH_TOKEN is required for live provider conformance');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required for live provider conformance');
  const endpoint = normalizeMessagesEndpoint(baseUrl);
  const anthropicVersion = options.anthropicVersion || '2023-06-01';

  async function postMessages(body) {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'anthropic-version': anthropicVersion,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      let errorBody = {};
      try {
        errorBody = await readJsonResponse(response);
      } catch {
        errorBody = { error: { type: 'http_error', message: `provider returned HTTP ${response.status}` } };
      }
      throw createProviderError(response, errorBody);
    }
    if (body.stream) {
      const events = await readStreamingEvents(response);
      events.servedRoute = events.reduce((servedRoute, event) => mergeServedRoute(servedRoute, extractServedRoute(event)), undefined)
        || { observed: false, reasonCode: 'served-route-unavailable' };
      return events;
    }
    const json = await readJsonResponse(response);
    json.servedRoute = extractServedRoute(json);
    json.responseContentType = getHeaderValue(response.headers, 'content-type');
    return json;
  }

  function baseBody(route, overrides = {}) {
    return {
      model: route.model,
      max_tokens: 64,
      messages: [{ role: 'user', content: 'Return ok.' }],
      ...overrides,
    };
  }

  return {
    async baseMessage(route) {
      return postMessages(baseBody(route));
    },
    async stream(route) {
      return postMessages(baseBody(route, { stream: true }));
    },
    async toolUse(route) {
      return postMessages(baseBody(route, {
        tools: [{ name: 'advisor_echo', description: 'Echo conformance input.', input_schema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] } }],
        tool_choice: { type: 'tool', name: 'advisor_echo' },
      }));
    },
    async usage(route) {
      return postMessages(baseBody(route));
    },
    async errorShape(route) {
      return postMessages(baseBody({ ...route, model: '__advisor_mode_invalid_model__' }));
    },
  };
}

function sanitizeError(error) {
  const status = error && (error.status || error.statusCode || error.code);
  const responseError = error && error.response && error.response.error;
  if (isPlainObject(responseError)) {
    return {
      status,
      type: responseError.type,
      message: typeof responseError.message === 'string' ? responseError.message : undefined,
    };
  }
  return { status, type: error && error.type, message: error && error.message };
}

function hasUsageFields(message) {
  return isPlainObject(message) && isPlainObject(message.usage)
    && Number.isFinite(Number(message.usage.input_tokens))
    && Number.isFinite(Number(message.usage.output_tokens));
}

function hasToolUse(message) {
  return isPlainObject(message)
    && Array.isArray(message.content)
    && message.content.some((block) => block && block.type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string');
}

function hasAnthropicErrorShape(error) {
  const shape = sanitizeError(error);
  return Number.isFinite(Number(shape.status))
    && isPlainObject(error && error.response)
    && isPlainObject(error.response.error)
    && typeof error.response.error.type === 'string'
    && typeof error.response.error.message === 'string';
}

function hasStreamingShape(events) {
  if (!Array.isArray(events)) return false;
  const types = new Set(events.map((event) => event && event.type));
  return types.has('message_start')
    && types.has('content_block_start')
    && types.has('content_block_delta')
    && types.has('message_delta')
    && types.has('message_stop');
}

function pass(name, evidence) {
  return { name, status: 'pass', evidence };
}

function fail(name, evidence, errorShape) {
  const result = { name, status: 'fail', evidence };
  if (errorShape) result.errorShape = errorShape;
  return result;
}

async function runSingleConformanceCheck(checkName, route, client, options = {}) {
  if (!ALLOWED_CHECKS.has(checkName)) {
    return fail(checkName, { reason: `unsupported conformance check: ${checkName}` });
  }
  if (!client || typeof client !== 'object') {
    return fail(checkName, { reason: 'client is required' });
  }

  try {
    if (checkName === 'base-message') {
      const message = await client.baseMessage(route, options);
      route.servedRoute = mergeServedRoute(route.servedRoute, message.servedRoute || extractServedRoute(message));
      if (isPlainObject(message) && message.type === 'message' && Array.isArray(message.content) && hasUsageFields(message)) {
        return pass(checkName, { messageType: message.type, contentBlocks: message.content.length, hasUsage: true });
      }
      return fail(checkName, { reason: 'base message response missing Anthropic-like message/content/usage fields' });
    }

    if (checkName === 'streaming') {
      const events = await client.stream(route, options);
      route.servedRoute = mergeServedRoute(route.servedRoute, events.servedRoute || (Array.isArray(events) ? events.reduce((servedRoute, event) => mergeServedRoute(servedRoute, extractServedRoute(event)), undefined) : undefined));
      if (hasStreamingShape(events)) {
        return pass(checkName, { eventTypes: events.map((event) => event.type) });
      }
      return fail(checkName, { reason: 'streaming response missing required Anthropic event sequence' });
    }

    if (checkName === 'tool-use') {
      const message = await client.toolUse(route, options);
      route.servedRoute = mergeServedRoute(route.servedRoute, message.servedRoute || extractServedRoute(message));
      if (hasToolUse(message)) {
        return pass(checkName, { toolUseBlocks: message.content.filter((block) => block.type === 'tool_use').length, stopReason: message.stop_reason });
      }
      return fail(checkName, { reason: 'tool-use response did not contain a tool_use block' });
    }

    if (checkName === 'usage-fields') {
      const message = await client.usage(route, options);
      route.servedRoute = mergeServedRoute(route.servedRoute, message.servedRoute || extractServedRoute(message));
      if (hasUsageFields(message)) {
        return pass(checkName, { inputTokens: Number(message.usage.input_tokens), outputTokens: Number(message.usage.output_tokens) });
      }
      return fail(checkName, { reason: 'usage field missing input_tokens or output_tokens' });
    }

    if (checkName === 'error-shape') {
      try {
        await client.errorShape(route, options);
        return fail(checkName, { reason: 'error-shape check expected a provider error but request succeeded' });
      } catch (error) {
        const errorShape = sanitizeError(error);
        if (hasAnthropicErrorShape(error)) {
          return pass(checkName, { status: errorShape.status, type: errorShape.type });
        }
        return fail(checkName, { reason: 'provider error is not Anthropic-like' }, errorShape);
      }
    }
  } catch (error) {
    return fail(checkName, { reason: error.message || 'check failed' }, sanitizeError(error));
  }

  return fail(checkName, { reason: `unsupported conformance check: ${checkName}` });
}

function createMockClient(mode = 'pass') {
  const client = {
    async baseMessage(route) {
      if (mode === 'fail') return { type: 'message', content: [] };
      return { id: 'msg_mock', type: 'message', model: route.model, content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } };
    },
    async stream(route) {
      if (mode === 'fail') return [{ type: 'unexpected_event' }];
      return [
        { type: 'message_start', message: { id: 'msg_stream', model: route.model } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } },
        { type: 'message_stop' },
      ];
    },
    async toolUse(route) {
      if (mode === 'fail') return { content: [{ type: 'text', text: 'no tool' }], usage: { input_tokens: 1, output_tokens: 1 } };
      return { id: 'msg_tool', model: route.model, stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'toolu_mock', name: 'advisor_echo', input: { value: 'ok' } }], usage: { input_tokens: 1, output_tokens: 1 } };
    },
    async usage(route) {
      if (mode === 'fail') return { usage: { input_tokens: 1 } };
      return { id: 'msg_usage', model: route.model, content: [{ type: 'text', text: 'usage' }], usage: { input_tokens: 1, output_tokens: 1 } };
    },
    async errorShape() {
      if (mode === 'fail') throw new Error('plain error');
      const error = new Error('mock auth error');
      error.status = 401;
      error.response = { error: { type: 'authentication_error', message: 'mock authentication error' } };
      throw error;
    },
  };
  return client;
}

async function runConformance(input = {}, options = {}) {
  const root = getRoot(options);
  const aliases = Array.isArray(input.aliases) && input.aliases.length > 0 ? input.aliases : ['opus'];
  const configPath = input.configPath || options.configPath;
  const loaded = loadRouteConfig(configPath, { root });
  const checkedAt = options.now || new Date().toISOString();
  const client = options.client || input.client || ((options.live || input.live) ? createLiveGatewayClient(options) : createMockClient(options.mock || input.mock || 'pass'));
  const routes = [];

  if (!loaded.ok) {
    return {
      artifact_type: 'provider-conformance',
      event: 'provider_conformance.completed',
      checked_at: checkedAt,
      status: 'fail',
      routes: aliases.map((alias) => ({
        requestedAlias: alias,
        routeConfigPath: loaded.configPath,
        checkedAt,
        status: 'fail',
        checks: REQUIRED_CHECKS.map((name) => fail(name, { reason: loaded.errors.join('; ') })),
      })),
    };
  }

  for (const alias of aliases) {
    const resolution = resolveRoute(loaded.config, alias, { routeConfigPath: loaded.configPath });
    if (!resolution.ok) {
      routes.push({
        requestedAlias: alias,
        routeConfigPath: loaded.configPath,
        checkedAt,
        status: 'fail',
        checks: REQUIRED_CHECKS.map((name) => fail(name, { reason: (resolution.errors || []).join('; ') || resolution.reasonCode })),
      });
      continue;
    }

    const conformanceRoute = {
      ...resolution,
      configuredRoute: {
        provider: resolution.provider,
        model: resolution.model,
        endpointRef: resolution.endpointRef,
      },
      servedRoute: { observed: false, reasonCode: 'served-route-unavailable' },
    };
    const checksToRun = REQUIRED_CHECKS.filter((name) => resolution.requiredConformance.includes(name));
    const checks = [];
    for (const checkName of checksToRun) {
      checks.push(await runSingleConformanceCheck(checkName, conformanceRoute, client, options));
    }
    routes.push({
      requestedAlias: alias,
      resolvedProvider: resolution.provider,
      resolvedModel: resolution.model,
      configuredRoute: conformanceRoute.configuredRoute,
      servedRoute: conformanceRoute.servedRoute,
      endpointRef: resolution.endpointRef,
      routeConfigPath: loaded.configPath,
      checkedAt,
      status: checks.every((check) => check.status === 'pass') ? 'pass' : 'fail',
      checks,
    });
  }

  return {
    artifact_type: 'provider-conformance',
    event: 'provider_conformance.completed',
    checked_at: checkedAt,
    status: routes.every((route) => route.status === 'pass') ? 'pass' : 'fail',
    routes,
  };
}

function buildConformanceArtifact(input = {}) {
  return {
    artifact_type: 'provider-conformance',
    event: 'provider_conformance.completed',
    checked_at: input.checked_at || input.checkedAt || new Date().toISOString(),
    status: input.status === 'pass' ? 'pass' : 'fail',
    routes: (input.routes || []).map((route) => ({
      requestedAlias: route.requestedAlias,
      resolvedProvider: route.resolvedProvider,
      resolvedModel: route.resolvedModel,
      configuredRoute: isPlainObject(route.configuredRoute) ? { ...route.configuredRoute } : { provider: route.resolvedProvider, model: route.resolvedModel, endpointRef: route.endpointRef },
      servedRoute: isPlainObject(route.servedRoute) ? { ...route.servedRoute } : { observed: false, reasonCode: 'served-route-unavailable' },
      endpointRef: route.endpointRef,
      routeConfigPath: route.routeConfigPath,
      checkedAt: route.checkedAt || input.checked_at,
      status: route.status === 'pass' ? 'pass' : 'fail',
      checks: (route.checks || []).map((check) => {
        const result = { name: check.name, status: check.status === 'pass' ? 'pass' : 'fail', evidence: isPlainObject(check.evidence) ? { ...check.evidence } : {} };
        if (isPlainObject(check.errorShape)) result.errorShape = { ...check.errorShape };
        return result;
      }),
    })),
  };
}

function validateConformanceArtifact(artifact) {
  const errors = [];
  JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  if (!isPlainObject(artifact)) return { ok: false, errors: ['artifact must be an object'] };
  const allowedTop = new Set(['artifact_type', 'event', 'checked_at', 'status', 'routes']);
  const allowedServed = new Set(['observed', 'provider', 'model', 'reasonCode']);
  Object.keys(artifact).forEach((key) => { if (!allowedTop.has(key)) errors.push(`unexpected field: ${key}`); });
  if (artifact.artifact_type !== 'provider-conformance') errors.push('artifact_type must be provider-conformance');
  if (artifact.event !== 'provider_conformance.completed') errors.push('event must be provider_conformance.completed');
  if (!['pass', 'fail'].includes(artifact.status)) errors.push('status must be pass or fail');
  if (typeof artifact.checked_at !== 'string' || artifact.checked_at.length === 0) errors.push('checked_at is required');
  if (!Array.isArray(artifact.routes) || artifact.routes.length === 0) errors.push('routes must be a non-empty array');
  for (const [index, route] of (artifact.routes || []).entries()) {
    ['requestedAlias', 'resolvedProvider', 'resolvedModel', 'endpointRef', 'routeConfigPath', 'checkedAt'].forEach((field) => {
      if (typeof route[field] !== 'string' || route[field].length === 0) errors.push(`routes[${index}].${field} is required`);
    });
    if (!isPlainObject(route.configuredRoute)) {
      errors.push(`routes[${index}].configuredRoute is required`);
    } else {
      ['provider', 'model', 'endpointRef'].forEach((field) => {
        if (typeof route.configuredRoute[field] !== 'string' || route.configuredRoute[field].length === 0) errors.push(`routes[${index}].configuredRoute.${field} is required`);
      });
    }
    if (!isPlainObject(route.servedRoute)) {
      errors.push(`routes[${index}].servedRoute is required`);
    } else {
      Object.keys(route.servedRoute).forEach((key) => { if (!allowedServed.has(key)) errors.push(`routes[${index}].servedRoute unexpected field: ${key}`); });
      if (typeof route.servedRoute.observed !== 'boolean') errors.push(`routes[${index}].servedRoute.observed is required`);
      if (route.servedRoute.observed) {
        if (typeof route.servedRoute.model !== 'string' || route.servedRoute.model.length === 0) errors.push(`routes[${index}].servedRoute.model is required when observed`);
      } else if (typeof route.servedRoute.reasonCode !== 'string' || route.servedRoute.reasonCode.length === 0) {
        errors.push(`routes[${index}].servedRoute.reasonCode is required when unobserved`);
      }
    }
    if (!['pass', 'fail'].includes(route.status)) errors.push(`routes[${index}].status must be pass or fail`);
    if (!Array.isArray(route.checks) || route.checks.length === 0) errors.push(`routes[${index}].checks must be a non-empty array`);
    for (const [checkIndex, check] of (route.checks || []).entries()) {
      if (!ALLOWED_CHECKS.has(check.name)) errors.push(`routes[${index}].checks[${checkIndex}].name unsupported`);
      if (!['pass', 'fail'].includes(check.status)) errors.push(`routes[${index}].checks[${checkIndex}].status must be pass or fail`);
      if (!isPlainObject(check.evidence)) errors.push(`routes[${index}].checks[${checkIndex}].evidence must be an object`);
    }
  }
  return { ok: errors.length === 0, errors };
}

function buildAuditEvent(artifact) {
  return {
    event: artifact.event,
    checked_at: artifact.checked_at,
    status: artifact.status,
    routes: artifact.routes.map((route) => ({
      requestedAlias: route.requestedAlias,
      resolvedProvider: route.resolvedProvider,
      resolvedModel: route.resolvedModel,
      configuredRoute: route.configuredRoute,
      servedRoute: route.servedRoute,
      endpointRef: route.endpointRef,
      status: route.status,
      checks: route.checks.map((check) => ({ name: check.name, status: check.status })),
    })),
  };
}

function writeConformanceArtifacts(artifact, options = {}) {
  const root = getRoot(options);
  const statePath = options.statePath || path.join(root, ...DEFAULT_STATE_FILE);
  const auditPath = options.auditPath || path.join(root, ...DEFAULT_AUDIT_FILE);
  const validation = validateConformanceArtifact(artifact);
  if (!validation.ok) {
    throw new Error(`invalid conformance artifact: ${validation.errors.join('; ')}`);
  }
  writeJson(statePath, artifact);
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.appendFileSync(auditPath, `${JSON.stringify(buildAuditEvent(artifact))}\n`);
  return { statePath, auditPath };
}

function parseArgs(argv) {
  const input = { aliases: [] };
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--alias' || arg === '--aliases') {
      input.aliases.push(...String(argv[index + 1] || '').split(',').filter(Boolean));
      index += 1;
    } else if (arg === '--config') {
      input.configPath = argv[index + 1];
      index += 1;
    } else if (arg === '--root') {
      options.root = argv[index + 1];
      index += 1;
    } else if (arg === '--live') {
      input.live = true;
      options.live = true;
    } else if (arg === '--mock') {
      options.mock = argv[index + 1] || 'pass';
      index += 1;
    }
  }
  if (input.aliases.length === 0 && process.env.ADVISOR_MODE_CONFORMANCE_ALIASES) {
    input.aliases = process.env.ADVISOR_MODE_CONFORMANCE_ALIASES.split(',').filter(Boolean);
  }
  if (!input.configPath && process.env.ADVISOR_MODE_PROVIDER_ROUTES) input.configPath = process.env.ADVISOR_MODE_PROVIDER_ROUTES;
  return { input, options };
}

async function main() {
  try {
    const { input, options } = parseArgs(process.argv.slice(2));
    const result = await runConformance(input, options);
    const artifact = buildConformanceArtifact(result);
    writeConformanceArtifacts(artifact, options);
    process.stdout.write(`${JSON.stringify({ event: artifact.event, status: artifact.status, routes: artifact.routes.length })}\n`);
    process.exitCode = artifact.status === 'pass' ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  createLiveGatewayClient,
  runConformance,
  runSingleConformanceCheck,
  buildConformanceArtifact,
  validateConformanceArtifact,
  writeConformanceArtifacts,
};
