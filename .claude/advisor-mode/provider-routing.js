const fs = require('node:fs');
const path = require('node:path');
const { runtimePath } = require('./runtime-paths.js');

const ROUTE_SCHEMA_PATH = path.join(__dirname, 'provider-routes.schema.json');
const DEFAULT_ROUTE_PATH = path.join('.claude', 'advisor-mode', 'provider-routes.example.json');
const ALLOWED_TOP_LEVEL_FIELDS = new Set(['schemaVersion', 'routes']);
const REQUIRED_ROUTE_FIELDS = ['provider', 'model', 'endpointRef', 'requiredConformance'];
const ALLOWED_ROUTE_FIELDS = new Set([...REQUIRED_ROUTE_FIELDS, 'credentialEnv', 'metadata']);
const ALLOWED_CONFORMANCE = new Set(['base-message', 'streaming', 'tool-use', 'usage-fields', 'error-shape']);
const FORBIDDEN_INPUT_FIELDS = new Set([
  'authorization',
  'headers',
  'requestBody',
  'body',
  'prompt',
  'response',
  'token',
  'bearerToken',
  'credentialValue',
]);
const STATIC_ROUTE_SOURCE_PREFIXES = ['configuredRoute', 'resolvedRoute', 'requestedAlias', 'routeConfig'];
const OBSERVED_MODEL_SOURCE_SUFFIX = '.body.model';

function getRoot(options = {}) {
  return options.root || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function readSchema() {
  return JSON.parse(fs.readFileSync(ROUTE_SCHEMA_PATH, 'utf8'));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasLiteralSecret(value) {
  if (typeof value !== 'string') return false;
  return /(?:sk-[A-Za-z0-9]|bearer\s+[A-Za-z0-9._-]|_VALUE$)/i.test(value);
}

function normalizeAliasValue(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeEndpointAlias(value) {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return undefined;
}

function normalizeProviderResponse(input) {
  if (!isPlainObject(input)) return null;
  if (isPlainObject(input.body)) return input;
  return { body: input, headers: input.headers };
}

function extractObservedModel(input) {
  const providerResponse = normalizeProviderResponse(input);
  const body = providerResponse && providerResponse.body;
  if (!isPlainObject(body) || typeof body.model !== 'string' || body.model.trim().length === 0) {
    return null;
  }
  const observedModel = body.model.trim();
  const responseId = typeof body.id === 'string' && body.id.trim().length > 0
    ? body.id.trim()
    : typeof providerResponse.requestId === 'string' && providerResponse.requestId.trim().length > 0
      ? providerResponse.requestId.trim()
      : providerResponse.headers && typeof providerResponse.headers['x-oneapi-request-id'] === 'string' && providerResponse.headers['x-oneapi-request-id'].trim().length > 0
        ? providerResponse.headers['x-oneapi-request-id'].trim()
        : providerResponse.headers && typeof providerResponse.headers['X-OneAPI-Request-Id'] === 'string' && providerResponse.headers['X-OneAPI-Request-Id'].trim().length > 0
          ? providerResponse.headers['X-OneAPI-Request-Id'].trim()
          : undefined;
  return { observedModel, responseId };
}

function validateRouteConfig(config) {
  const errors = [];
  readSchema();

  if (!isPlainObject(config)) return { ok: false, errors: ['route config must be an object'] };

  Object.keys(config).forEach((key) => {
    if (!ALLOWED_TOP_LEVEL_FIELDS.has(key)) errors.push(`unexpected field: ${key}`);
  });
  if (config.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!isPlainObject(config.routes)) errors.push('routes must be an object');

  if (isPlainObject(config.routes)) {
    Object.entries(config.routes).forEach(([alias, route]) => {
      if (!/^[a-z][a-z0-9_-]*$/i.test(alias)) errors.push(`routes.${alias} alias must be a non-empty semantic name`);
      if (!isPlainObject(route)) {
        errors.push(`routes.${alias} must be an object`);
        return;
      }
      Object.keys(route).forEach((key) => {
        if (!ALLOWED_ROUTE_FIELDS.has(key)) errors.push(`routes.${alias} unexpected field: ${key}`);
        if (FORBIDDEN_INPUT_FIELDS.has(key)) errors.push(`routes.${alias}.${key} is forbidden`);
      });
      REQUIRED_ROUTE_FIELDS.forEach((field) => {
        if (!Object.hasOwn(route, field)) errors.push(`routes.${alias}.${field} is required`);
      });
      ['provider', 'model', 'endpointRef'].forEach((field) => {
        if (typeof route[field] !== 'string' || route[field].length === 0) errors.push(`routes.${alias}.${field} must be a non-empty string`);
        if (hasLiteralSecret(route[field])) errors.push(`routes.${alias}.${field} must not contain a literal secret`);
      });
      if (route.credentialEnv !== undefined) {
        if (typeof route.credentialEnv !== 'string' || route.credentialEnv.length === 0) errors.push(`routes.${alias}.credentialEnv must be a non-empty string`);
        if (hasLiteralSecret(route.credentialEnv)) errors.push(`routes.${alias}.credentialEnv must not contain a literal secret`);
      }
      if (!Array.isArray(route.requiredConformance)) {
        errors.push(`routes.${alias}.requiredConformance must be an array`);
      } else {
        const seen = new Set();
        route.requiredConformance.forEach((name, index) => {
          if (!ALLOWED_CONFORMANCE.has(name)) errors.push(`routes.${alias}.requiredConformance[${index}] unsupported conformance: ${name}`);
          if (seen.has(name)) errors.push(`routes.${alias}.requiredConformance[${index}] duplicates ${name}`);
          seen.add(name);
        });
      }
      if (route.metadata !== undefined && !isPlainObject(route.metadata)) errors.push(`routes.${alias}.metadata must be an object`);
      if (isPlainObject(route.metadata)) {
        Object.entries(route.metadata).forEach(([key, value]) => {
          if (!['string', 'number', 'boolean'].includes(typeof value)) errors.push(`routes.${alias}.metadata.${key} must be scalar`);
          if (hasLiteralSecret(value)) errors.push(`routes.${alias}.metadata.${key} must not contain a literal secret`);
        });
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

function loadRouteConfig(filePath, options = {}) {
  const root = getRoot(options);
  const configPath = filePath || path.join(root, DEFAULT_ROUTE_PATH);
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const validation = validateRouteConfig(config);
    if (!validation.ok) return { ok: false, errors: validation.errors, configPath };
    return { ok: true, config, errors: [], configPath };
  } catch (error) {
    return {
      ok: false,
      errors: [error.code === 'ENOENT' ? `route config not found: ${configPath}` : `route config invalid JSON: ${configPath}`],
      configPath,
    };
  }
}

function resolveRoute(config, alias, options = {}) {
  const requestedAlias = alias || options.requestedAlias;
  const validation = validateRouteConfig(config);
  if (!validation.ok) {
    return { ok: false, alias: requestedAlias, reasonCode: 'invalid-route-config', errors: validation.errors };
  }
  const route = config.routes[requestedAlias];
  if (!route) {
    return { ok: false, alias: requestedAlias, reasonCode: 'missing-route', errors: [`missing route for alias: ${requestedAlias}`] };
  }
  return {
    ok: true,
    alias: requestedAlias,
    provider: route.provider,
    model: route.model,
    endpointRef: route.endpointRef,
    credentialEnv: route.credentialEnv,
    requiredConformance: route.requiredConformance.slice(),
    metadata: isPlainObject(route.metadata) ? { ...route.metadata } : {},
    routeConfigPath: options.routeConfigPath,
    conformanceStatus: options.conformanceStatus || route.conformanceStatus || 'unchecked',
  };
}

function normalizeServedRoute(input, options = {}) {
  const source = normalizeAliasValue(options.source);
  const sourceField = normalizeAliasValue(options.sourceField);
  const extracted = extractObservedModel(input);
  if (!extracted) {
    return {
      observed: false,
      reasonCode: 'served-route-unavailable',
      sourceChecked: sourceField || source,
    };
  }
  const servedRoute = {
    observed: true,
    observedModel: extracted.observedModel,
  };
  if (source) servedRoute.source = source;
  if (sourceField) servedRoute.sourceField = sourceField;
  if (extracted.responseId) servedRoute.responseId = extracted.responseId;
  if (normalizeEndpointAlias(options.providerAlias)) servedRoute.providerAlias = normalizeEndpointAlias(options.providerAlias);
  if (normalizeEndpointAlias(options.endpointAlias)) servedRoute.endpointAlias = normalizeEndpointAlias(options.endpointAlias);
  return servedRoute;
}

function assertServedRouteSourceAvailable(source, input) {
  const normalizedSource = normalizeAliasValue(source);
  if (!normalizedSource) {
    return { ok: false, reasonCode: 'invalid-served-route-source', sourceChecked: source };
  }
  if (
    STATIC_ROUTE_SOURCE_PREFIXES.some((prefix) => normalizedSource === prefix || normalizedSource.startsWith(`${prefix}.`))
    || !normalizedSource.endsWith(OBSERVED_MODEL_SOURCE_SUFFIX)
  ) {
    return { ok: false, reasonCode: 'invalid-served-route-source', sourceChecked: normalizedSource };
  }
  const servedRoute = normalizeServedRoute(input, { source: 'provider-response', sourceField: normalizedSource });
  if (!servedRoute.observed) {
    return { ok: false, reasonCode: 'served-route-source-unavailable', sourceChecked: normalizedSource };
  }
  return { ok: true, sourceChecked: normalizedSource, servedRoute };
}

function sanitizeResolution(resolution = {}, input = {}) {
  const event = {
    requestedAlias: resolution.alias || resolution.requestedAlias || input.requestedAlias,
    routeConfigPath: resolution.routeConfigPath || input.routeConfigPath,
    conformanceStatus: resolution.conformanceStatus || input.conformanceStatus || 'unchecked',
    recordedAt: input.recordedAt || input.now || new Date().toISOString(),
  };
  if (resolution.ok === false) {
    event.ok = false;
    event.reasonCode = resolution.reasonCode || 'route-resolution-failed';
    if (Array.isArray(resolution.errors)) event.errors = resolution.errors.slice();
    return event;
  }
  event.ok = true;
  event.configuredProvider = resolution.provider;
  event.configuredModel = resolution.model;
  if (normalizeEndpointAlias(input.providerAlias || resolution.providerAlias || resolution.provider)) {
    event.providerAlias = normalizeEndpointAlias(input.providerAlias || resolution.providerAlias || resolution.provider);
  }
  if (normalizeEndpointAlias(input.endpointAlias || resolution.endpointRef)) {
    event.endpointAlias = normalizeEndpointAlias(input.endpointAlias || resolution.endpointRef);
  }
  return event;
}

function buildResolvedRouteAuditEvent(resolution, input = {}) {
  const event = {
    event: 'provider_route.resolved',
    ...sanitizeResolution(resolution, input),
  };
  const servedRoute = input.servedRoute;
  if (servedRoute && servedRoute.observed === true) {
    event.observedModel = servedRoute.observedModel;
    if (servedRoute.source) event.source = servedRoute.source;
    if (servedRoute.sourceField) event.sourceField = servedRoute.sourceField;
    if (servedRoute.responseId) event.responseId = servedRoute.responseId;
    if (servedRoute.providerAlias && !event.providerAlias) event.providerAlias = servedRoute.providerAlias;
    if (servedRoute.endpointAlias && !event.endpointAlias) event.endpointAlias = servedRoute.endpointAlias;
  } else if (servedRoute) {
    event.observedModel = null;
    event.reasonCode = servedRoute.reasonCode || event.reasonCode;
    if (servedRoute.sourceChecked) event.sourceChecked = servedRoute.sourceChecked;
  }
  return event;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeResolvedRouteArtifact(resolution, options = {}) {
  const root = getRoot(options);
  const event = buildResolvedRouteAuditEvent(resolution, options);
  const artifactPath = options.artifactPath || runtimePath(root, ['state', 'provider-route.json'], options);
  writeJson(artifactPath, event);
  if (options.appendAudit === true) {
    const auditPath = options.auditPath || runtimePath(root, ['audit', 'events.jsonl'], options);
    fs.mkdirSync(path.dirname(auditPath), { recursive: true });
    fs.appendFileSync(auditPath, `${JSON.stringify(event)}\n`);
  }
  return { ok: true, path: artifactPath, artifact: event };
}

module.exports = {
  validateRouteConfig,
  loadRouteConfig,
  resolveRoute,
  normalizeServedRoute,
  assertServedRouteSourceAvailable,
  buildResolvedRouteAuditEvent,
  writeResolvedRouteArtifact,
};
