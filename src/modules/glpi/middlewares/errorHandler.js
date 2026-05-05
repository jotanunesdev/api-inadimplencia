const mysqlUnavailableCodes = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'PROTOCOL_CONNECTION_LOST',
  'ER_ACCESS_DENIED_ERROR',
]);

function isMysqlUnavailableError(err) {
  const code = String(err?.code ?? '');
  return mysqlUnavailableCodes.has(code) || code.startsWith('ER_');
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err?.statusCode) {
    if (err.statusCode >= 500) {
      console.error('[glpi-error]', err.message, err.stack);
    }

    res.status(err.statusCode).json({
      error: err.message,
      code: err.code ?? 'APP_ERROR',
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  if (isMysqlUnavailableError(err)) {
    console.error('[glpi-error]', err.message, err.stack);
    res.status(503).json({
      error: 'Banco GLPI indisponivel.',
      code: 'DB_UNAVAILABLE',
    });
    return;
  }

  if (err instanceof SyntaxError && Object.prototype.hasOwnProperty.call(err, 'body')) {
    res.status(400).json({
      error: 'JSON invalido.',
      code: 'INVALID_JSON',
    });
    return;
  }

  if (err) {
    console.error('[glpi-error]', err.message, err.stack);
  }

  res.status(500).json({
    error: 'Erro interno do servidor.',
    code: 'INTERNAL_ERROR',
  });
}

module.exports = {
  errorHandler,
  isMysqlUnavailableError,
};
