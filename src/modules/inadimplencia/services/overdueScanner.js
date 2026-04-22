const { findAllOverdue } = require('../models/notificationsModel');
const notificationService = require('./notificationService');
const { env } = require('../config/env');

const SCAN_INTERVAL_MS = env.NOTIFICATIONS_OVERDUE_SCAN_MS || 60000;
let intervalId = null;
let isRunning = false;

async function tick() {
  // Re-entrancy guard: skip if already running
  if (isRunning) {
    console.log('[overdueScanner] tick skipped - previous tick still in progress');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    console.log('[overdueScanner] tick started');

    // Get all overdue sales globally (no username filter)
    const overdueSales = await findAllOverdue();

    console.log(`[overdueScanner] found ${overdueSales.length} overdue sales`);

    let created = 0;
    let deduped = 0;

    // Process each overdue sale
    for (const sale of overdueSales) {
      const destinatario = sale.RESPONSAVEL;
      
      if (!destinatario) {
        continue;
      }

      const saleSnapshot = {
        numVenda: sale.NUM_VENDA,
        cliente: sale.CLIENTE,
        cpfCnpj: sale.CPF_CNPJ,
        empreendimento: sale.EMPREENDIMENTO,
        valorInadimplente: sale.VALOR_INADIMPLENTE,
        responsavel: sale.RESPONSAVEL,
        proximaAcao: sale.PROXIMA_ACAO,
        statusKanban: sale.KANBAN_STATUS,
      };

      try {
        const result = await notificationService.createOverdueNotification({
          destinatario,
          saleSnapshot,
        });

        if (result) {
          created++;
        } else {
          deduped++;
        }
      } catch (error) {
        console.error('[overdueScanner] failed to create notification for sale', {
          numVenda: sale.NUM_VENDA,
          destinatario,
          error: error.message,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`[overdueScanner] tick completed in ${durationMs}ms - created: ${created}, deduped: ${deduped}`);
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error('[overdueScanner] tick error', { durationMs, error: error.message });
  } finally {
    isRunning = false;
  }
}

function start() {
  // Idempotent: don't start if already running
  if (intervalId) {
    console.log('[overdueScanner] already started, skipping');
    return;
  }

  if (process.env.NODE_ENV === 'test') {
    console.log('[overdueScanner] skipping start in test environment');
    return;
  }

  console.log(`[overdueScanner] starting with interval ${SCAN_INTERVAL_MS}ms`);
  
  // Run first tick immediately
  tick().catch((error) => {
    console.error('[overdueScanner] initial tick failed', error);
  });

  // Schedule subsequent ticks
  intervalId = setInterval(() => {
    tick().catch((error) => {
      console.error('[overdueScanner] scheduled tick failed', error);
    });
  }, SCAN_INTERVAL_MS);
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[overdueScanner] stopped');
  }
}

module.exports = {
  start,
  stop,
  tick,
};
