function notFoundHandler(req, res) {
  res.status(404).json({ ok: false, error: 'not_found' });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof SyntaxError && Object.prototype.hasOwnProperty.call(err, 'body')) {
    return res.status(400).json({ ok: false, error: 'invalid_json' });
  }

  const statusCode = err.statusCode || 500;
  const publicMessage = err.publicMessage || 'internal_error';

  if (statusCode >= 500 && publicMessage !== 'mail_failed') {
    console.error('[fluig-error]', err);
  }

  return res.status(statusCode).json({ ok: false, error: publicMessage });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
