const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { WebSocket, WebSocketServer } = require('ws');
const { env } = require('../config/env');

const execFileAsync = promisify(execFile);
const GIT_BINARY = process.platform === 'win32' ? 'git.exe' : 'git';

const state = {
  history: [],
  lastPayload: null,
  websocketServer: null,
  broadcastInterval: null,
  upgradeAttached: false,
};

function createHttpError(statusCode, message, details) {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (details !== undefined) {
    error.details = details;
  }

  return error;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function formatBytes(bytes) {
  const normalized = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];

  if (normalized === 0) {
    return '0 B';
  }

  const exponent = Math.min(Math.floor(Math.log(normalized) / Math.log(1024)), units.length - 1);
  const value = normalized / 1024 ** exponent;

  return `${round(value)} ${units[exponent]}`;
}

function formatPercent(value) {
  return round(value, 2);
}

function formatTimeLabel(timestamp) {
  return new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function normalizeOrigin(origin) {
  return String(origin ?? '').trim().toLowerCase();
}

function isAllowedOrigin(origin) {
  const normalized = normalizeOrigin(origin);

  if (!normalized) {
    return env.CORS_ALLOW_ALL;
  }

  return env.CORS_ALLOW_ALL || env.CORS_ORIGINS.includes(normalized);
}

function sanitizeProcessId(input) {
  const parsed = Number(input);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw createHttpError(400, 'ID do PM2 invalido.');
  }

  return String(parsed);
}

function buildWebsocketMetadata(request) {
  const metadata = {
    path: '/pm2/ws',
    event: 'pm2.metrics',
    intervalMs: env.WS_INTERVAL_MS,
    historyLimit: env.WS_HISTORY_LIMIT,
  };

  if (!request) {
    return metadata;
  }

  const forwardedProtocol = String(request.headers['x-forwarded-proto'] ?? '').trim().toLowerCase();
  const isSecure =
    request.secure === true ||
    forwardedProtocol === 'https' ||
    request.protocol === 'https';
  const host = request.get?.('host') || request.headers.host;

  if (host) {
    metadata.url = `${isSecure ? 'wss' : 'ws'}://${host}${metadata.path}`;
  }

  return metadata;
}

async function runCommand(command, args, options = {}) {
  try {
    return await execFileAsync(command, args, {
      cwd: options.cwd,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 10,
      timeout: options.timeoutMs ?? 15000,
    });
  } catch (error) {
    const stderr = String(error.stderr ?? '').trim();
    const stdout = String(error.stdout ?? '').trim();
    const message =
      stderr ||
      stdout ||
      `Falha ao executar o comando: ${command} ${args.join(' ')}`;

    throw createHttpError(503, message, {
      command,
      args,
      cwd: options.cwd ?? null,
    });
  }
}

function runPm2(args) {
  if (process.platform === 'win32') {
    return runCommand('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      ['pm2', ...args].join(' '),
    ]);
  }

  return runCommand('pm2', args);
}

function runGit(args, options = {}) {
  return runCommand(GIT_BINARY, args, options);
}

function isRunningStatus(status) {
  return ['online', 'launching'].includes(status);
}

function buildProcessActions(id, cwd, status) {
  const canUpdate = Boolean(cwd);
  const target = String(id);

  return {
    update: {
      method: 'POST',
      path: `/pm2/processes/${target}/actions/update`,
      enabled: canUpdate,
      commandPreview: `pm2 stop ${target} && git pull origin ${env.UPDATE_BRANCH} && pm2 restart ${target} --update-env`,
      requiresGitRepository: true,
      workingDirectory: cwd,
    },
    reload: {
      method: 'POST',
      path: `/pm2/processes/${target}/actions/reload`,
      enabled: isRunningStatus(status),
      commandPreview: `pm2 reload ${target} --update-env`,
    },
    pause: {
      method: 'POST',
      path: `/pm2/processes/${target}/actions/pause`,
      enabled: isRunningStatus(status),
      commandPreview: `pm2 stop ${target}`,
    },
    delete: {
      method: 'DELETE',
      path: `/pm2/processes/${target}`,
      enabled: true,
      commandPreview: `pm2 delete ${target}`,
    },
  };
}

function normalizePm2Process(rawProcess) {
  const pm2Env = rawProcess.pm2_env ?? {};
  const monit = rawProcess.monit ?? {};
  const id = Number(rawProcess.pm_id ?? pm2Env.pm_id ?? -1);
  const status = String(pm2Env.status ?? 'unknown');
  const memoryBytes = Number(monit.memory ?? 0);
  const cpuPercentRaw = Number(monit.cpu ?? 0);
  const cwd = pm2Env.pm_cwd || pm2Env.cwd || null;
  const startedAt = Number(pm2Env.pm_uptime ?? 0) || null;
  const uptimeMs = startedAt ? Math.max(0, Date.now() - startedAt) : 0;

  return {
    id,
    name: rawProcess.name ?? pm2Env.name ?? `pm2-${id}`,
    pid: Number(rawProcess.pid ?? pm2Env.pm_pid ?? 0) || null,
    status,
    isRunning: isRunningStatus(status),
    namespace: pm2Env.namespace ?? null,
    cwd,
    script: pm2Env.pm_exec_path ?? pm2Env.script ?? null,
    execMode: pm2Env.exec_mode ?? null,
    interpreter: pm2Env.exec_interpreter ?? null,
    instances: Number(pm2Env.instances ?? 0) || 1,
    restarts: Number(pm2Env.restart_time ?? 0) || 0,
    unstableRestarts: Number(pm2Env.unstable_restarts ?? 0) || 0,
    version: pm2Env.version ?? null,
    startedAt: startedAt ? new Date(startedAt).toISOString() : null,
    uptimeMs,
    memory: {
      bytes: memoryBytes,
      megabytes: round(memoryBytes / 1024 / 1024),
      formatted: formatBytes(memoryBytes),
    },
    cpu: {
      percentRaw: round(cpuPercentRaw),
    },
    actions: buildProcessActions(id, cwd, status),
  };
}

async function listPm2Processes() {
  const { stdout } = await runPm2(['jlist']);

  let parsed;
  try {
    parsed = JSON.parse(stdout || '[]');
  } catch (_error) {
    throw createHttpError(500, 'Nao foi possivel interpretar a resposta do PM2.');
  }

  if (!Array.isArray(parsed)) {
    throw createHttpError(500, 'Formato invalido retornado pelo PM2.');
  }

  return parsed.map(normalizePm2Process).sort((left, right) => left.id - right.id);
}

function buildProcessSummary(processes) {
  return {
    total: processes.length,
    running: processes.filter((process) => process.isRunning).length,
    stopped: processes.filter((process) => process.status === 'stopped').length,
    errored: processes.filter((process) => process.status === 'errored').length,
  };
}

function buildMemorySummary(processes) {
  const runningProcesses = processes.filter((process) => process.isRunning);
  const totalServerBytes = os.totalmem();
  const freeServerBytes = os.freemem();
  const hostUsedBytes = totalServerBytes - freeServerBytes;
  const pm2UsedBytes = runningProcesses.reduce(
    (total, process) => total + process.memory.bytes,
    0
  );
  const pm2UsedPercent = totalServerBytes === 0 ? 0 : (pm2UsedBytes / totalServerBytes) * 100;
  const hostUsedPercent = totalServerBytes === 0 ? 0 : (hostUsedBytes / totalServerBytes) * 100;

  return {
    totalServerBytes,
    totalServerFormatted: formatBytes(totalServerBytes),
    freeServerBytes,
    freeServerFormatted: formatBytes(freeServerBytes),
    hostUsedBytes,
    hostUsedFormatted: formatBytes(hostUsedBytes),
    hostUsedPercent: formatPercent(hostUsedPercent),
    usedByPm2Bytes: pm2UsedBytes,
    usedByPm2Formatted: formatBytes(pm2UsedBytes),
    usedByPm2Percent: formatPercent(pm2UsedPercent),
  };
}

function buildCpuSummary(processes) {
  const runningProcesses = processes.filter((process) => process.isRunning);
  const coreCount = Math.max(os.cpus()?.length ?? 1, 1);
  const totalCapacityPercent = coreCount * 100;
  const usedByPm2RawPercent = runningProcesses.reduce(
    (total, process) => total + process.cpu.percentRaw,
    0
  );
  const usedByPm2PercentOfServer = totalCapacityPercent === 0
    ? 0
    : (usedByPm2RawPercent / totalCapacityPercent) * 100;

  return {
    coreCount,
    totalCapacityPercent,
    usedByPm2RawPercent: formatPercent(usedByPm2RawPercent),
    usedByPm2PercentOfServer: formatPercent(usedByPm2PercentOfServer),
  };
}

function recordHistory(summary, generatedAt) {
  const point = {
    timestamp: generatedAt,
    label: formatTimeLabel(generatedAt),
    memoryPercent: summary.memory.usedByPm2Percent,
    cpuPercent: summary.cpu.usedByPm2PercentOfServer,
  };

  state.history.push(point);

  while (state.history.length > env.WS_HISTORY_LIMIT) {
    state.history.shift();
  }
}

function buildChart() {
  return {
    labels: state.history.map((point) => point.label),
    points: state.history.map((point) => ({
      timestamp: point.timestamp,
      label: point.label,
      memoryPercent: point.memoryPercent,
      cpuPercent: point.cpuPercent,
    })),
    series: [
      {
        key: 'memory',
        label: 'Memoria RAM',
        color: 'green',
        data: state.history.map((point) => point.memoryPercent),
      },
      {
        key: 'cpu',
        label: 'CPU',
        color: 'blue',
        data: state.history.map((point) => point.cpuPercent),
      },
    ],
  };
}

function buildPayload(processes, generatedAt, request, options = {}) {
  const summary = {
    processes: buildProcessSummary(processes),
    memory: buildMemorySummary(processes),
    cpu: buildCpuSummary(processes),
  };

  if (options.recordHistory !== false) {
    recordHistory(summary, generatedAt);
  }

  const payload = {
    generatedAt,
    websocket: buildWebsocketMetadata(request),
    summary,
    chart: buildChart(),
    processes,
  };

  state.lastPayload = payload;
  return payload;
}

async function collectOverview(request, options = {}) {
  const processes = await listPm2Processes();
  const generatedAt = new Date().toISOString();
  return buildPayload(processes, generatedAt, request, options);
}

async function findProcessById(id) {
  const processId = sanitizeProcessId(id);
  const processes = await listPm2Processes();
  const process = processes.find((item) => String(item.id) === processId);

  if (!process) {
    throw createHttpError(404, 'Instancia PM2 nao encontrada.');
  }

  return process;
}

async function ensureGitRepository(cwd) {
  if (!cwd) {
    throw createHttpError(400, 'A instancia PM2 nao possui diretorio de trabalho definido.');
  }

  const { stdout } = await runGit(['rev-parse', '--is-inside-work-tree'], { cwd });
  if (String(stdout).trim().toLowerCase() !== 'true') {
    throw createHttpError(400, 'O diretorio da instancia PM2 nao e um repositorio Git.');
  }
}

async function getOverview(request) {
  return collectOverview(request, { recordHistory: true });
}

async function getProcesses(request) {
  const payload = await collectOverview(request, { recordHistory: false });

  return {
    generatedAt: payload.generatedAt,
    websocket: payload.websocket,
    summary: payload.summary,
    chart: payload.chart,
    processes: payload.processes,
  };
}

async function getProcessDetails(id, request) {
  const processId = sanitizeProcessId(id);
  const payload = await collectOverview(request, { recordHistory: false });
  const process = payload.processes.find((item) => String(item.id) === processId);

  if (!process) {
    throw createHttpError(404, 'Instancia PM2 nao encontrada.');
  }

  return {
    generatedAt: payload.generatedAt,
    websocket: payload.websocket,
    summary: payload.summary,
    process,
  };
}

async function pauseProcess(id, request) {
  const processId = sanitizeProcessId(id);
  await findProcessById(processId);
  await runPm2(['stop', processId]);
  return collectOverview(request, { recordHistory: true });
}

async function reloadProcess(id, request) {
  const processId = sanitizeProcessId(id);
  await findProcessById(processId);
  await runPm2(['reload', processId, '--update-env']);
  return collectOverview(request, { recordHistory: true });
}

async function deleteProcess(id, request) {
  const processId = sanitizeProcessId(id);
  await findProcessById(processId);
  await runPm2(['delete', processId]);
  return collectOverview(request, { recordHistory: true });
}

async function updateProcess(id, request) {
  const processId = sanitizeProcessId(id);
  const process = await findProcessById(processId);

  await ensureGitRepository(process.cwd);

  let stopSucceeded = false;
  try {
    await runPm2(['stop', processId]);
    stopSucceeded = true;
    await runGit(['pull', 'origin', env.UPDATE_BRANCH], { cwd: process.cwd });
    await runPm2(['restart', processId, '--update-env']);
  } catch (error) {
    if (stopSucceeded) {
      try {
        await runPm2(['restart', processId, '--update-env']);
      } catch (_restartError) {
        // Mantem o erro original da operacao de update.
      }
    }

    throw error;
  }

  return collectOverview(request, { recordHistory: true });
}

async function getWebsocketInfo(request) {
  return {
    websocket: buildWebsocketMetadata(request),
  };
}

function serializeEvent(event, data) {
  return JSON.stringify({
    event,
    data,
  });
}

async function sendInitialPayload(socket) {
  const payload =
    state.lastPayload ?? (await collectOverview(null, { recordHistory: true }));

  if (socket.readyState === WebSocket.OPEN) {
    socket.send(serializeEvent('pm2.metrics', payload));
  }
}

async function broadcastMetrics() {
  const websocketServer = state.websocketServer;
  if (!websocketServer || websocketServer.clients.size === 0) {
    return;
  }

  try {
    const payload = await collectOverview(null, { recordHistory: true });
    const message = serializeEvent('pm2.metrics', payload);

    websocketServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  } catch (error) {
    const message = serializeEvent('pm2.error', {
      message: error.message,
      statusCode: error.statusCode ?? 500,
      details: error.details ?? null,
      generatedAt: new Date().toISOString(),
    });

    websocketServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

function attachRealtimeServer(server) {
  if (state.upgradeAttached) {
    return;
  }

  const websocketServer = new WebSocketServer({ noServer: true });
  state.websocketServer = websocketServer;
  state.upgradeAttached = true;

  websocketServer.on('connection', (socket) => {
    sendInitialPayload(socket).catch((error) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          serializeEvent('pm2.error', {
            message: error.message,
            statusCode: error.statusCode ?? 500,
            details: error.details ?? null,
            generatedAt: new Date().toISOString(),
          })
        );
      }
    });
  });

  server.on('upgrade', (request, socket, head) => {
    let pathname;
    try {
      pathname = new URL(request.url, 'http://localhost').pathname;
    } catch (_error) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    if (pathname !== '/pm2/ws') {
      socket.destroy();
      return;
    }

    if (!isAllowedOrigin(request.headers.origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    websocketServer.handleUpgrade(request, socket, head, (client) => {
      websocketServer.emit('connection', client, request);
    });
  });

  if (!state.broadcastInterval) {
    state.broadcastInterval = setInterval(() => {
      broadcastMetrics().catch(() => {});
    }, env.WS_INTERVAL_MS);

    state.broadcastInterval.unref?.();
  }
}

module.exports = {
  attachRealtimeServer,
  createHttpError,
  deleteProcess,
  getOverview,
  getProcessDetails,
  getProcesses,
  getWebsocketInfo,
  isAllowedOrigin,
  pauseProcess,
  reloadProcess,
  updateProcess,
};
