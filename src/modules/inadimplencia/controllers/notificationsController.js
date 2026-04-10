const { getInadimplenciaNotificationSnapshot } = require('../models/inadimplenciaNotificationModel');
const { registerSSEClient } = require('../services/inadimplenciaNotificationRealtime');

// GET /notificacoes/inadimplencia?username=<user>
async function getSnapshot(req, res, next) {
  try {
    const username = req.query.username;
    if (!username) {
      return res.status(400).json({ error: 'username é obrigatório.' });
    }
    const snapshot = await getInadimplenciaNotificationSnapshot(username);
    res.json(snapshot);
  } catch (err) {
    next(err);
  }
}

// GET /notificacoes/inadimplencia/stream?username=<user>
async function openStream(req, res, next) {
  try {
    const username = req.query.username;
    if (!username) {
      return res.status(400).json({ error: 'username é obrigatório.' });
    }
    await registerSSEClient(username, res);
  } catch (err) {
    next(err);
  }
}

module.exports = { getSnapshot, openStream };