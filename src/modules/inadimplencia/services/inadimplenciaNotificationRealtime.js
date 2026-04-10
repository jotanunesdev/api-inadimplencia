const { getInadimplenciaNotificationSnapshot } = require('../models/notificationsModel');

const listenersByUsername = new Map();

const HEARTBEAT_INTERVAL_MS = 15000;

function addListener(username, res) {
  if (!listenersByUsername.has(username)) {
    listenersByUsername.set(username, new Set());
  }
  listenersByUsername.get(username).add(res);
}

function removeListener(username, res) {
  const set = listenersByUsername.get(username);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    listenersByUsername.delete(username);
  }
}

async function broadcastInadimplenciaSnapshot(username) {
  const set = listenersByUsername.get(username);
  if (!set || set.size === 0) return;

  try {
    const snapshot = await getInadimplenciaNotificationSnapshot(username);
    const payload = `event: inadimplencia-notifications.snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`;
    for (const res of set) {
      res.write(payload);
    }
  } catch (err) {
    console.error(`[inadimplenciaNotificationRealtime] Erro ao broadcast para ${username}:`, err);
  }
}

// Registra um cliente SSE e envia snapshot imediatamente
async function registerSSEClient(username, res) {
  // Headers padrão SSE — iguais ao sistema de referência
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  addListener(username, res);

  // Envia snapshot inicial imediatamente ao conectar
  await broadcastInadimplenciaSnapshot(username);

  // Heartbeat a cada 15s para manter a conexão viva
  const heartbeatId = setInterval(() => {
    res.write(': ping\n\n');
  }, HEARTBEAT_INTERVAL_MS);

  // Polling periódico: atualiza a snapshot a cada 60s sem precisar de evento externo
  // Isso garante que novas vendas inadimplentes apareçam automaticamente
  const pollId = setInterval(async () => {
    await broadcastInadimplenciaSnapshot(username);
  }, 60_000);

  res.on('close', () => {
    clearInterval(heartbeatId);
    clearInterval(pollId);
    removeListener(username, res);
  });
}

module.exports = {
  registerSSEClient,
  broadcastInadimplenciaSnapshot,
};