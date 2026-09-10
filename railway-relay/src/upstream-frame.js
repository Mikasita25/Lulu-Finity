'use strict';

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function text(value, max = 220) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function structuralFailureDetail(value) {
  const source = record(value);
  if (!source) return '';

  const type = text(source.type || source.event || source.name, 80).toLowerCase();
  const status = Number(source.status || source.statusCode || 0);
  const explicitFailure = source.ok === false || source.success === false || status >= 400 || /(?:^|[._-])error(?:$|[._-])|failed|failure/.test(type);

  const directError = source.error;
  if (typeof directError === 'string' && directError.trim()) return text(directError);
  if (record(directError)) {
    const nested = text(directError.message || directError.detail || directError.error || directError.code);
    if (nested) return nested;
  }

  if (Array.isArray(source.errors) && source.errors.length) {
    const first = source.errors[0];
    const nested = typeof first === 'string' ? text(first) : record(first) ? text(first.message || first.detail || first.error || first.code) : '';
    if (nested) return nested;
  }

  if (explicitFailure) {
    const message = text(source.message || source.detail || source.reason || source.code || source.statusText);
    if (message) return message;
  }

  return '';
}

function isEventEnvelope(value) {
  const source = record(value);
  return Boolean(source && typeof source.type === 'string' && source.type.trim() && record(source.data));
}

function inspectUpstreamFrame(raw, isBinary = false) {
  if (isBinary) return { valid:false, failureDetail:'', kind:'binary' };

  let parsed;
  try {
    parsed = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw));
  } catch {
    return { valid:false, failureDetail:'', kind:'invalid-json' };
  }

  const source = record(parsed);
  const values = Array.isArray(parsed)
    ? parsed
    : Array.isArray(source?.messages)
      ? source.messages
      : [parsed];

  const topFailure = structuralFailureDetail(parsed);
  if (topFailure) return { valid:false, failureDetail:topFailure, kind:'error' };

  for (const value of values) {
    const failure = structuralFailureDetail(value);
    if (failure) return { valid:false, failureDetail:failure, kind:'error' };
  }

  const meaningful = values.some(isEventEnvelope);
  return { valid:meaningful, failureDetail:'', kind:meaningful ? 'event' : 'unknown-json' };
}

module.exports = { inspectUpstreamFrame, structuralFailureDetail, isEventEnvelope };
