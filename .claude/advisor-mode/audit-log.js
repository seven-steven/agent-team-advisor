#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { runtimePath } = require('./runtime-paths.js');

const FORBIDDEN_KEYS = new Set([
  'authorization',
  'headers',
  'requestBody',
  'prompt',
  'messages',
  'response',
  'body',
  'rawResponse',
  'raw_response',
  'token',
  'bearerToken',
  'credentialValue',
]);

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function redactString(value) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, '[REDACTED]')
    .replace(/sk-[A-Za-z0-9._-]+/gi, '[REDACTED]');
}

function sanitizeAuditEvent(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizeAuditEvent(item));
  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      output[key] = sanitizeAuditEvent(item);
    }
    return output;
  }
  if (typeof value === 'string') return redactString(value);
  return value;
}

function buildCorrelationFields(input = {}, options = {}) {
  const sessionId = nonEmpty(input.sessionId) || nonEmpty(input.session_id) || nonEmpty(options.sessionId) || nonEmpty(options.session_id);
  const taskId = nonEmpty(input.taskId) || nonEmpty(input.task_id) || nonEmpty(options.taskId) || nonEmpty(options.task_id);
  const correlationKey = nonEmpty(input.correlationKey)
    || nonEmpty(options.correlationKey)
    || sessionId
    || taskId
    || `audit-${crypto.createHash('sha256').update(stableStringify(input)).digest('hex').slice(0, 24)}`;
  const fields = { correlationKey };
  if (taskId) fields.taskId = taskId;
  if (sessionId) fields.sessionId = sessionId;
  return fields;
}

function resolveAuditPath(options = {}) {
  const root = options.root || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  return options.auditPath || runtimePath(root, ['audit', 'events.jsonl'], options);
}

function appendAuditEvent(event, options = {}) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('audit event must be an object');
  if (typeof event.event !== 'string' || event.event.trim().length === 0) throw new Error('audit event requires a non-empty event string');
  const auditPath = resolveAuditPath(options);
  const sanitized = sanitizeAuditEvent(event);
  const outputEvent = {
    timestamp: new Date().toISOString(),
    ...sanitized,
    event: event.event.trim(),
    ...buildCorrelationFields(event, options),
  };
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.appendFileSync(auditPath, `${JSON.stringify(outputEvent)}\n`);
  return { ok: true, auditPath, event: outputEvent };
}

function readAuditEvents(options = {}) {
  const auditPath = resolveAuditPath(options);
  if (!fs.existsSync(auditPath)) return { ok: true, auditPath, events: [], parseErrors: [] };
  const events = [];
  const parseErrors = [];
  fs.readFileSync(auditPath, 'utf8').split(/\r?\n/).forEach((line, index) => {
    if (line.trim().length === 0) return;
    try {
      events.push(JSON.parse(line));
    } catch (error) {
      parseErrors.push({ line: index + 1, message: error.message });
    }
  });
  return { ok: true, auditPath, events, parseErrors };
}

function filterAuditEvents(events, filter = {}) {
  return events.filter((event) => {
    const taskId = event.taskId || event.task_id;
    const sessionId = event.sessionId || event.session_id;
    if (filter.taskId !== undefined && taskId !== filter.taskId) return false;
    if (filter.sessionId !== undefined && sessionId !== filter.sessionId) return false;
    if (filter.correlationKey !== undefined && event.correlationKey !== filter.correlationKey) return false;
    return true;
  });
}

function parseArgs(argv = []) {
  const userArgs = path.basename(argv[1] || '') === 'audit-log.js' ? argv.slice(2) : argv;
  const commandIndex = userArgs[0] && !userArgs[0].startsWith('--') ? 0 : -1;
  const args = { command: commandIndex >= 0 ? userArgs[commandIndex] : 'raw' };
  const rest = commandIndex >= 0 ? userArgs.slice(commandIndex + 1) : userArgs;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--root') args.root = rest[++index];
    else if (arg === '--runtime-root') args.runtimeRoot = rest[++index];
    else if (arg === '--task-id') args.taskId = rest[++index];
    else if (arg === '--session-id') args.sessionId = rest[++index];
    else if (arg === '--correlation-key') args.correlationKey = rest[++index];
  }
  return args;
}

function writeCliResult(io, payload) {
  io.stdout.write(`${JSON.stringify(payload)}\n`);
}

function main(argv = process.argv, io = { stdout: process.stdout, stderr: process.stderr }) {
  const args = parseArgs(argv);
  const read = readAuditEvents(args);
  let events = read.events;
  let view = args.command;
  if (args.command === 'task') {
    if (!args.taskId) {
      writeCliResult(io, { status: 'error', view, count: 0, events: [], parseErrors: read.parseErrors, error: 'task view requires --task-id' });
      return 1;
    }
    events = filterAuditEvents(events, { taskId: args.taskId });
  } else if (args.command === 'session') {
    if (!args.sessionId) {
      writeCliResult(io, { status: 'error', view, count: 0, events: [], parseErrors: read.parseErrors, error: 'session view requires --session-id' });
      return 1;
    }
    events = filterAuditEvents(events, { sessionId: args.sessionId });
  } else if (args.command !== 'raw') {
    view = 'unknown';
    writeCliResult(io, { status: 'error', view, count: 0, events: [], parseErrors: read.parseErrors, error: `unknown command: ${args.command}` });
    return 1;
  }
  if (args.correlationKey) events = filterAuditEvents(events, { correlationKey: args.correlationKey });
  writeCliResult(io, { status: 'ok', view, count: events.length, events, parseErrors: read.parseErrors });
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv);
}

module.exports = {
  appendAuditEvent,
  readAuditEvents,
  filterAuditEvents,
  buildCorrelationFields,
  sanitizeAuditEvent,
  main,
};
