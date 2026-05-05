const { env } = require('../config/env');

let envImpl = env;

function setEnsureConfiguredDependencies(dependencies = {}) {
  if (dependencies.env) {
    envImpl = dependencies.env;
  }
}

function ensureConfigured(req, res, next) {
  if (!envImpl.ENABLED) {
    res.status(503).json({
      error: 'Modulo GLPI desabilitado.',
      code: 'GLPI_DISABLED',
    });
    return;
  }

  if (!envImpl.isConfigured) {
    res.status(503).json({
      error: 'Modulo GLPI nao configurado.',
      code: 'GLPI_NOT_CONFIGURED',
      missingRequired: envImpl.missingRequired,
    });
    return;
  }

  next();
}

module.exports = {
  ensureConfigured,
  setEnsureConfiguredDependencies,
};
