const pm2Service = require('../services/pm2Service');

async function getHealth(_req, res, next) {
  try {
    const data = await pm2Service.getOverview(null);
    res.json({
      status: 'ok',
      generatedAt: data.generatedAt,
      summary: data.summary,
    });
  } catch (error) {
    next(error);
  }
}

async function getOverview(req, res, next) {
  try {
    const data = await pm2Service.getOverview(req);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function getProcesses(req, res, next) {
  try {
    const data = await pm2Service.getProcesses(req);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function getProcessDetails(req, res, next) {
  try {
    const data = await pm2Service.getProcessDetails(req.params.id, req);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function getWebsocketInfo(req, res, next) {
  try {
    const data = await pm2Service.getWebsocketInfo(req);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function updateProcess(req, res, next) {
  try {
    const data = await pm2Service.updateProcess(req.params.id, req);
    res.json({
      message: 'Instancia PM2 atualizada com sucesso.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function reloadProcess(req, res, next) {
  try {
    const data = await pm2Service.reloadProcess(req.params.id, req);
    res.json({
      message: 'Instancia PM2 recarregada com sucesso.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function pauseProcess(req, res, next) {
  try {
    const data = await pm2Service.pauseProcess(req.params.id, req);
    res.json({
      message: 'Instancia PM2 pausada com sucesso.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function deleteProcess(req, res, next) {
  try {
    const data = await pm2Service.deleteProcess(req.params.id, req);
    res.json({
      message: 'Instancia PM2 removida com sucesso.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  deleteProcess,
  getHealth,
  getOverview,
  getProcessDetails,
  getProcesses,
  getWebsocketInfo,
  pauseProcess,
  reloadProcess,
  updateProcess,
};
