const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_PATH = path.join(__dirname, 'context-packet.schema.json');
const FORBIDDEN_FIELDS = new Set(['transcript', 'full_transcript', 'raw_log']);
const ARRAY_FIELDS = [
  'changed_files',
  'relevant_diff_excerpts',
  'relevant_errors',
  'explicit_questions',
];

function readSchema() {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

function copyArray(value) {
  return Array.isArray(value) ? value.map((item) => copyValue(item)) : [];
}

function copyObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyValue(item)]));
}

function copyValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => copyValue(item));
  }
  if (value && typeof value === 'object') {
    return copyObject(value);
  }
  return value;
}

function buildContextPacket(input = {}) {
  const packet = {
    packet_type: 'advisor-final-review-context',
    changed_files: copyArray(input.changed_files),
    relevant_diff_excerpts: copyArray(input.relevant_diff_excerpts),
    relevant_errors: copyArray(input.relevant_errors),
    explicit_questions: copyArray(input.explicit_questions),
    created_at: input.created_at || new Date().toISOString(),
  };

  if (typeof input.correlationKey === 'string' && input.correlationKey.length > 0) {
    packet.correlationKey = input.correlationKey;
  }
  if (typeof input.task_summary === 'string') {
    packet.task_summary = input.task_summary;
  }

  const verificationSummary = copyObject(input.verification_summary);
  if (verificationSummary) {
    packet.verification_summary = verificationSummary;
  }

  return packet;
}

function validateContextPacket(packet) {
  const schema = readSchema();
  const errors = [];

  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
    return { ok: false, errors: ['packet must be an object'] };
  }

  const allowedFields = new Set(Object.keys(schema.properties || {}));
  for (const key of Object.keys(packet)) {
    if (!allowedFields.has(key)) {
      errors.push(`unexpected field: ${key}`);
    }
    if (FORBIDDEN_FIELDS.has(key)) {
      errors.push(`forbidden field: ${key}`);
    }
  }

  for (const key of schema.required || []) {
    if (!Object.hasOwn(packet, key)) {
      errors.push(`missing required field: ${key}`);
    }
  }

  if (packet.packet_type !== 'advisor-final-review-context') {
    errors.push('packet_type must be advisor-final-review-context');
  }

  for (const key of ARRAY_FIELDS) {
    if (!Array.isArray(packet[key])) {
      errors.push(`${key} must be an array`);
    }
  }

  if (!Array.isArray(packet.explicit_questions) || packet.explicit_questions.length === 0) {
    errors.push('explicit_questions must include at least one question');
  }

  if (Array.isArray(packet.explicit_questions)) {
    packet.explicit_questions.forEach((question, index) => {
      if (typeof question !== 'string' || question.length === 0) {
        errors.push(`explicit_questions[${index}] must be a non-empty string`);
      }
    });
  }

  if (Array.isArray(packet.changed_files)) {
    packet.changed_files.forEach((file, index) => {
      if (typeof file !== 'string' || file.length === 0) {
        errors.push(`changed_files[${index}] must be a non-empty string`);
      }
    });
  }

  if (Array.isArray(packet.relevant_diff_excerpts)) {
    packet.relevant_diff_excerpts.forEach((excerpt, index) => {
      if (!excerpt || typeof excerpt !== 'object' || Array.isArray(excerpt)) {
        errors.push(`relevant_diff_excerpts[${index}] must be an object`);
        return;
      }
      const excerptFields = Object.keys(excerpt);
      for (const field of excerptFields) {
        if (!['file', 'excerpt'].includes(field)) {
          errors.push(`relevant_diff_excerpts[${index}] unexpected field: ${field}`);
        }
      }
      if (typeof excerpt.file !== 'string' || excerpt.file.length === 0) {
        errors.push(`relevant_diff_excerpts[${index}].file must be a non-empty string`);
      }
      if (typeof excerpt.excerpt !== 'string' || excerpt.excerpt.length === 0) {
        errors.push(`relevant_diff_excerpts[${index}].excerpt must be a non-empty string`);
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

module.exports = {
  buildContextPacket,
  validateContextPacket,
};
