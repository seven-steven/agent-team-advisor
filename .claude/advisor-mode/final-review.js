const fs = require('node:fs');
const path = require('node:path');

const VERDICT_SCHEMA_PATH = path.join(__dirname, 'verdict.schema.json');
const VALID_VERDICT_VALUES = {
  status: new Set(['PASS', 'CONCERNS', 'FAIL', 'BLOCKED']),
  risk: new Set(['low', 'medium', 'high', 'critical']),
  confidence: new Set(['low', 'medium', 'high']),
};
const FORBIDDEN_FIELDS = new Set(['transcript', 'full_transcript', 'raw_log']);
const ARRAY_FIELDS = [
  'changed_files',
  'relevant_diff_excerpts',
  'relevant_errors',
  'explicit_questions',
];

function readContextSchema() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'context-packet.schema.json'), 'utf8'));
}

function readVerdictSchema() {
  return JSON.parse(fs.readFileSync(VERDICT_SCHEMA_PATH, 'utf8'));
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
  const schema = readContextSchema();
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

function normalizeRecommendedActions(recommendedActions) {
  if (!Array.isArray(recommendedActions)) {
    return [];
  }

  return recommendedActions.map((action, index) => {
    const generatedId = `rec-${String(index + 1).padStart(3, '0')}`;
    if (typeof action === 'string') {
      return { id: generatedId, description: action };
    }
    if (action && typeof action === 'object' && !Array.isArray(action)) {
      return {
        ...action,
        id: typeof action.id === 'string' && action.id.length > 0 ? action.id : generatedId,
      };
    }
    return { id: generatedId, description: '' };
  });
}

function validateStringArray(value, field, errors, options = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return;
  }
  if (options.minItems && value.length < options.minItems) {
    errors.push(`${field} must include at least ${options.minItems} item`);
  }
  value.forEach((item, index) => {
    if (typeof item !== 'string' || item.length === 0) {
      errors.push(`${field}[${index}] must be a non-empty string`);
    }
  });
}

function validateVerdict(verdict) {
  const schema = readVerdictSchema();
  const errors = [];

  if (!verdict || typeof verdict !== 'object' || Array.isArray(verdict)) {
    return { ok: false, errors: ['verdict must be an object'], direct_completion_allowed: false };
  }

  const allowedFields = new Set(Object.keys(schema.properties || {}));
  Object.keys(verdict).forEach((key) => {
    if (!allowedFields.has(key)) {
      errors.push(`unexpected field: ${key}`);
    }
  });

  (schema.required || []).forEach((field) => {
    if (!Object.hasOwn(verdict, field)) {
      errors.push(`missing required field: ${field}`);
    }
  });

  for (const [field, values] of Object.entries(VALID_VERDICT_VALUES)) {
    if (!values.has(verdict[field])) {
      errors.push(`${field} must be one of: ${Array.from(values).join(', ')}`);
    }
  }

  validateStringArray(verdict.blocking_findings, 'blocking_findings', errors);
  validateStringArray(verdict.verification_guidance, 'verification_guidance', errors);
  validateStringArray(verdict.validation_checklist, 'validation_checklist', errors, { minItems: 1 });

  const normalizedActions = normalizeRecommendedActions(verdict.recommended_actions);
  if (!Array.isArray(verdict.recommended_actions)) {
    errors.push('recommended_actions must be an array');
  }
  normalizedActions.forEach((action, index) => {
    if (typeof action.id !== 'string' || action.id.length === 0) {
      errors.push(`recommended_actions[${index}].id must be a non-empty string`);
    }
    if (typeof action.description !== 'string' || action.description.length === 0) {
      errors.push(`recommended_actions[${index}].description must be a non-empty string`);
    }
  });

  for (const field of ['correlationKey', 'context_packet_ref', 'created_at']) {
    if (typeof verdict[field] !== 'string' || verdict[field].length === 0) {
      errors.push(`${field} must be a non-empty string`);
    }
  }

  const normalizedVerdict = {
    ...verdict,
    recommended_actions: normalizedActions,
  };

  return {
    ok: errors.length === 0,
    errors,
    verdict: normalizedVerdict,
    direct_completion_allowed: errors.length === 0 && verdict.status === 'PASS',
  };
}

module.exports = {
  buildContextPacket,
  validateContextPacket,
  normalizeRecommendedActions,
  validateVerdict,
};
