const notificationService = require('./notificationService');

const connections = new Map(); // Map<username, Set<res>>
const HEARTBEAT_INTERVAL_MS = 15000;

function normalizeUsername(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

function addListener(username, res) {
  const normalizedUsername = normalizeUsername(username);
  if (!connections.has(normalizedUsername)) {
    connections.set(normalizedUsername, new Set());
  }
  connections.get(normalizedUsername).add(res);
}

function removeListener(username, res) {
  const normalizedUsername = normalizeUsername(username);
  const set = connections.get(normalizedUsername);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    connections.delete(normalizedUsername);
  }
}

function safeWrite(res, data) {
  try {
    res.write(data);
    return true;
  } catch (error) {
    console.error('[sseHub] write failed, dropping listener', { error: error.message });
    return false;
  }
}

function broadcastToUser(username, eventName, data) {
  const normalizedUsername = normalizeUsername(username);
  const set = connections.get(normalizedUsername);
  if (!set || set.size === 0) return;

  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  const listenersToRemove = [];

  for (const res of set) {
    if (!safeWrite(res, payload)) {
      listenersToRemove.push(res);
    }
  }

  // Remove failed listeners
  for (const res of listenersToRemove) {
    removeListener(normalizedUsername, res);
    try {
      res.end();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

async function register(username, res) {
  const normalizedUsername = normalizeUsername(username);

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Add listener
  addListener(normalizedUsername, res);

  // Send initial snapshot (unread only)
  try {
    const snapshot = await notificationService.getSnapshotForUser(normalizedUsername);
    const snapshotPayload = `event: inadimplencia-notifications.snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`;
    safeWrite(res, snapshotPayload);
  } catch (error) {
    console.error('[sseHub] failed to send initial snapshot', { username: normalizedUsername, error: error.message });
  }

  // Heartbeat every 15s
  const heartbeatId = setInterval(() => {
    if (!safeWrite(res, ': ping\n\n')) {
      clearInterval(heartbeatId);
      removeListener(normalizedUsername, res);
      try {
        res.end();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Cleanup on close/error
  const cleanup = () => {
    clearInterval(heartbeatId);
    removeListener(normalizedUsername, res);
  };

  res.on('close', cleanup);
  res.on('error', cleanup);
}

function emitNew(username, notificationDTO) {
  broadcastToUser(username, 'inadimplencia-notifications.new', notificationDTO);
}

function emitUpdate(username, notificationDTO) {
  broadcastToUser(username, 'inadimplencia-notifications.update', notificationDTO);
}

function listenerCount(username) {
  const normalizedUsername = normalizeUsername(username);
  const set = connections.get(normalizedUsername);
  return set ? set.size : 0;
}

// Clear all connections - for testing purposes only
function clearConnections() {
  connections.clear();
}

module.exports = {
  register,
  emitNew,
  emitUpdate,
  listenerCount,
  clearConnections,
};
