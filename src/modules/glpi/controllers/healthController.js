const { env } = require('../config/env');

let pingPoolImpl = async () => require('../config/db').pingPool();
let envImpl = env;

function setHealthDependencies(dependencies = {}) {
  if (typeof dependencies.pingPool === 'function') {
    pingPoolImpl = dependencies.pingPool;
  }

  if (dependencies.env) {
    envImpl = dependencies.env;
  }
}

async function getHealth(req, res, next) {
  try {
    let dbReachable = false;

    if (envImpl.isConfigured && envImpl.ENABLED) {
      dbReachable = await pingPoolImpl();
    }

    const status = envImpl.isConfigured && envImpl.ENABLED && dbReachable ? 200 : 503;

    res.status(status).json({
      status: status === 200 ? 'ok' : 'degraded',
      configured: Boolean(envImpl.isConfigured),
      enabled: Boolean(envImpl.ENABLED),
      missingRequired: envImpl.missingRequired,
      dbReachable: Boolean(dbReachable),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      configured: Boolean(envImpl.isConfigured),
      enabled: Boolean(envImpl.ENABLED),
      missingRequired: envImpl.missingRequired,
      dbReachable: false,
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = {
  getHealth,
  setHealthDependencies,
};
