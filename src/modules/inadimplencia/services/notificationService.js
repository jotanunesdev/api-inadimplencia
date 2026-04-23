const notificationsRepository = require('../models/notificationsRepository');
const sseHub = require('./sseHub');

// Mutex in-memory for dedupe keys to serialize concurrent SELECT-before-INSERT
const dedupeMutex = new Set();

function buildError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normalizeUsername(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

function mapRowToDTO(row) {
  if (!row) return null;

  const payload = typeof row.PAYLOAD === 'string' ? JSON.parse(row.PAYLOAD) : row.PAYLOAD;

  return {
    id: row.ID,
    tipo: row.TIPO,
    type: row.TIPO === 'VENDA_ATRIBUIDA' ? 'assignment' : 'sale_overdue',
    numVenda: row.NUM_VENDA,
    cliente: payload.cliente,
    cpfCnpj: payload.cpfCnpj,
    empreendimento: payload.empreendimento,
    valorInadimplente: payload.valorInadimplente,
    responsavel: payload.responsavel,
    proximaAcao: row.PROXIMA_ACAO ? row.PROXIMA_ACAO.toISOString() : null,
    status: payload.status,
    adminUserCode: row.ORIGEM_USUARIO, // ORIGEM_USUARIO maps to adminUserCode in DTO
    lida: row.LIDA === 1,
    createdAt: row.DT_CRIACAO ? row.DT_CRIACAO.toISOString() : null,
    readAt: row.DT_LEITURA ? row.DT_LEITURA.toISOString() : null,
    deletedAt: row.DT_EXCLUSAO ? row.DT_EXCLUSAO.toISOString() : null,
  };
}

function formatProximaAcaoDate(date) {
  if (!date) return null;
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function createAssignmentNotification({ numVenda, destinatario, adminUserCode, saleSnapshot }) {
  try {
    const payload = {
      numVenda,
      cliente: saleSnapshot.cliente,
      cpfCnpj: saleSnapshot.cpfCnpj,
      empreendimento: saleSnapshot.empreendimento,
      valorInadimplente: saleSnapshot.valorInadimplente,
      responsavel: saleSnapshot.responsavel,
      dtAtribuicao: saleSnapshot.dtAtribuicao,
    };

    const insertedRow = await notificationsRepository.insert({
      tipo: 'VENDA_ATRIBUIDA',
      usuarioDestinatario: destinatario,
      origemUsuario: adminUserCode, // Stored in ORIGEM_USUARIO, NOT in PAYLOAD
      numVenda,
      proximaAcao: null,
      payload,
    });

    const dto = mapRowToDTO(insertedRow);

    // Broadcast after successful persistence (persist-then-broadcast)
    sseHub.emitNew(normalizeUsername(destinatario), dto);

    return dto;
  } catch (error) {
    console.error('[notificationService] insert failed', { tipo: 'VENDA_ATRIBUIDA', numVenda, destinatario, error: error.message });
    throw error;
  }
}

async function createOverdueNotification({ destinatario, saleSnapshot }) {
  const proximaAcao = saleSnapshot.proximaAcao;
  const numVenda = saleSnapshot.numVenda;

  // Build dedupe key: TIPO|USUARIO|NUM_VENDA|PROXIMA_ACAO_DIA (YYYY-MM-DD for daily granularity)
  const proximaAcaoDia = formatProximaAcaoDate(proximaAcao);
  const dedupeKey = `VENDA_ATRASADA|${normalizeUsername(destinatario)}|${numVenda}|${proximaAcaoDia}`;

  // Mutex: add to set before SELECT, remove in finally
  if (dedupeMutex.has(dedupeKey)) {
    // Another operation is processing this same dedupe key, skip to avoid duplicate
    return null;
  }

  dedupeMutex.add(dedupeKey);

  try {
    // SELECT-before-INSERT for dedupe
    const existing = await notificationsRepository.findByDedupeKey({
      tipo: 'VENDA_ATRASADA',
      usuarioDestinatario: destinatario,
      numVenda,
      proximaAcao,
    });

    if (existing) {
      // Already notified for this day
      return null;
    }

    const payload = {
      numVenda,
      cliente: saleSnapshot.cliente,
      cpfCnpj: saleSnapshot.cpfCnpj,
      empreendimento: saleSnapshot.empreendimento,
      valorInadimplente: saleSnapshot.valorInadimplente,
      responsavel: saleSnapshot.responsavel,
      proximaAcao: saleSnapshot.proximaAcao,
      statusKanban: saleSnapshot.statusKanban,
    };

    const insertedRow = await notificationsRepository.insert({
      tipo: 'VENDA_ATRASADA',
      usuarioDestinatario: destinatario,
      origemUsuario: null, // System notification, no ORIGEM_USUARIO
      numVenda,
      proximaAcao,
      payload,
    });

    const dto = mapRowToDTO(insertedRow);

    // Broadcast after successful persistence
    sseHub.emitNew(normalizeUsername(destinatario), dto);

    return dto;
  } catch (error) {
    console.error('[notificationService] insert failed', { tipo: 'VENDA_ATRASADA', numVenda, destinatario, error: error.message });
    throw error;
  } finally {
    dedupeMutex.delete(dedupeKey);
  }
}

async function markAsRead({ id, username }) {
  const row = await notificationsRepository.markRead(id, username);

  if (!row) {
    throw buildError('Notification not found', 404);
  }

  const dto = mapRowToDTO(row);

  // Emit update event
  sseHub.emitUpdate(normalizeUsername(username), dto);

  return dto;
}

async function markAllAsRead({ username }) {
  const updated = await notificationsRepository.markAllRead(username);

  // Emit update event to refresh client state
  sseHub.emitUpdate(normalizeUsername(username), { type: 'read_all', updated });

  return { updated };
}

async function softDelete({ id, username }) {
  const row = await notificationsRepository.softDelete(id, username).catch((error) => {
    if (error.statusCode === 409) throw error;
    throw error;
  });

  if (!row) {
    throw buildError('Notification not found', 404);
  }

  const dto = mapRowToDTO(row);
  sseHub.emitUpdate(normalizeUsername(username), dto);
  return dto;
}

async function notifyUnassignmentForSale({ numVenda, previousUsername }) {
  if (!Number.isSafeInteger(numVenda)) {
    throw buildError('NUM_VENDA invalido.', 400);
  }

  const normalizedPreviousUsername = normalizeUsername(previousUsername);
  if (!normalizedPreviousUsername) {
    return [];
  }

  try {
    const rows = await notificationsRepository.softDeleteAssignmentNotificationsBySaleAndUsername({
      numVenda,
      username: normalizedPreviousUsername,
    });

    const dtExclusao = rows[0]?.DT_EXCLUSAO || null;
    const dtExclusaoIso = dtExclusao ? dtExclusao.toISOString() : null;

    const updatedNotifications = rows.map(mapRowToDTO);

    updatedNotifications.forEach((dto) => {
      sseHub.emitUpdate(normalizedPreviousUsername, dto);
    });

    if (updatedNotifications.length === 0) {
      return [];
    }

    return updatedNotifications.map((dto) => ({
      ...dto,
      deletedAt: dtExclusaoIso,
    }));
  } catch (error) {
    console.error('[notificationService] unassignment update failed', {
      numVenda,
      previousUsername,
      error: error.message,
    });
    throw error;
  }
}

async function getPaginated({ username, page = 1, pageSize = 20, lida }) {
  const result = await notificationsRepository.listPaginatedForCurrentResponsibility({
    username,
    page,
    pageSize,
    lida,
  });

  return {
    page,
    pageSize,
    total: result.total,
    unreadCount: result.unreadCount,
    notifications: result.rows.map(mapRowToDTO),
  };
}

async function getSnapshotForUser(username) {
  const { rows, totalUnread } = await notificationsRepository.listUnreadForCurrentResponsibility({
    username,
    limit: 20,
  });

  return {
    page: 1,
    pageSize: 20,
    total: totalUnread,
    unreadCount: totalUnread,
    notifications: rows.map(mapRowToDTO),
  };
}

module.exports = {
  createAssignmentNotification,
  createOverdueNotification,
  markAsRead,
  markAllAsRead,
  softDelete,
  notifyUnassignmentForSale,
  getPaginated,
  getSnapshotForUser,
};
