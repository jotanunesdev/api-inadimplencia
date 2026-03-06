function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.publicMessage = message;
  return error;
}

function isRequiredString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function validateAuditPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createValidationError('invalid_body');
  }

  const { subject, content, meta } = body;

  if (!isRequiredString(subject)) {
    throw createValidationError('subject is required');
  }

  if (!isRequiredString(content)) {
    throw createValidationError('content is required');
  }

  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    throw createValidationError('meta.userId is required');
  }

  if (!isRequiredString(meta.userId)) {
    throw createValidationError('meta.userId is required');
  }

  return {
    subject,
    content,
    meta: { ...meta },
  };
}

function logAuditEvent(payload) {
  const { meta = {} } = payload;
  const timestamp = meta.timestamp || new Date().toISOString();
  const docId = meta.docId || '-';
  const docVersion = meta.docVersion || '-';

  console.log(
    `[fluig-audit] timestamp=${timestamp} userId=${meta.userId} docId=${docId} docVersion=${docVersion}`
  );
}

module.exports = {
  validateAuditPayload,
  logAuditEvent,
};
