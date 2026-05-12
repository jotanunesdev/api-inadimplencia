const { createSerasaPefinHttpClient } = require('../services/serasaPefinHttpClient');
const { handleWebhook } = require('../services/serasaPefinService');
const { env } = require('../config/env');

const TEST_DOCUMENTS = [
  { documento: '000.012.095-23', descricao: 'CLIENTE TESTE ABCB' },
  { documento: '000.084.414-48', descricao: 'BJRNRNSD OIOIE' },
  { documento: '074.205.658-99', descricao: 'TESTE CPF SEM POSITIVO' },
  { documento: '042.367.984-84', descricao: 'NCUH KLCOHKKHH ECAJAE NCGMLU' },
  { documento: '43.557.445/0001-80', descricao: 'ESFERA ARENA E NEGOCIOS SPE LTDA' },
  { documento: '00.079.854/0001-05', descricao: 'U F NXALWPULN ZK EWCQIXG' },
  { documento: '168.816.700-52', descricao: 'TST PEFIN' },
  { documento: '115.724.678-86', descricao: 'TST FLEX' },
];

const WEBHOOK_TEST_EVENT_TYPES = [
  'inclusao/sucesso',
  'inclusao/erro',
  'avalista/sucesso',
  'avalista/erro',
  'baixa/sucesso',
  'baixa/erro',
];

function isProductionEnvironment() {
  const nodeEnv = process.env.NODE_ENV || env.NODE_ENV || 'development';
  return nodeEnv === 'production';
}

function buildTestDebtPayload(documento) {
  const normalizedDoc = documento.replace(/\D/g, '');
  const normalizedCreditorDoc = env.SERASA_CREDITOR_DOCUMENT.replace(/\D/g, '');
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return {
    value: 100.00,
    areaInformante: env.SERASA_AREA_INFORMANTE || '0001',
    dueDate: dueDate.toISOString().split('T')[0],
    categoryId: 'FI',
    debtor: {
      documentNumber: normalizedDoc,
      name: 'TESTE HOMOLOGACAO',
      address: {
        zipCode: '01310100',
        addressLine: 'AV PAULISTA 1000',
        district: 'BELA VISTA',
        city: 'SAO PAULO',
        state: 'SP',
      },
    },
    creditor: {
      documentNumber: normalizedCreditorDoc,
    },
    contractNumber: 'TEST-CONTRACT-' + Date.now(),
    debtType: 'PEFIN',
  };
}

async function testAuth(req, res, next) {
  try {
    if (isProductionEnvironment()) {
      return res.status(403).json({ error: 'Endpoint de teste bloqueado em produção.' });
    }

    const httpClient = createSerasaPefinHttpClient();
    
    if (!httpClient.isConfigured()) {
      return res.status(503).json({ 
        error: 'Serasa PEFIN não configurado.',
        missingRequired: env.SERASA_MISSING_REQUIRED || [],
      });
    }

    const token = await httpClient.getBearerToken({ forceRefresh: true });
    
    res.json({ 
      data: {
        authenticated: true,
        tokenPrefix: token ? token.slice(0, 20) + '...' : null,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ 
        error: err.message,
        code: err.code,
      });
    }
    next(err);
  }
}

async function testDebt(req, res, next) {
  try {
    if (isProductionEnvironment()) {
      return res.status(403).json({ error: 'Endpoint de teste bloqueado em produção.' });
    }

    const { documento } = req.body || {};

    if (!documento) {
      return res.status(400).json({ error: 'DOCUMENTO é obrigatório para teste de envio.' });
    }

    const normalizedDoc = documento.replace(/\D/g, '');
    const testDoc = TEST_DOCUMENTS.find(d => d.documento.replace(/\D/g, '') === normalizedDoc);

    if (!testDoc) {
      return res.status(400).json({ 
        error: 'Documento não autorizado para teste.',
        allowedDocuments: TEST_DOCUMENTS.map(d => d.documento),
      });
    }

    const httpClient = createSerasaPefinHttpClient();
    
    if (!httpClient.isConfigured()) {
      return res.status(503).json({ 
        error: 'Serasa PEFIN não configurado.',
        missingRequired: env.SERASA_MISSING_REQUIRED || [],
      });
    }

    const payload = buildTestDebtPayload(normalizedDoc);
    const response = await httpClient.postDebt(payload);

    if (!response || !response.transactionId) {
      return res.status(502).json({ 
        error: 'Serasa não retornou transactionId.',
        response,
      });
    }

    res.json({ 
      data: {
        transactionId: response.transactionId,
        cadusKey: response.cadusKey || null,
        cadusSerie: response.cadusSerie || null,
        documento: testDoc.documento,
        descricao: testDoc.descricao,
        mensagem: 'Negativação de teste enviada. Aguardando webhook assíncrono.',
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ 
        error: err.message,
        code: err.code,
      });
    }
    next(err);
  }
}

async function simulateWebhook(req, res, next) {
  try {
    if (isProductionEnvironment()) {
      return res.status(403).json({ error: 'Endpoint de teste bloqueado em produção.' });
    }

    const { transactionId, eventType, error } = req.body || {};

    if (!transactionId) {
      return res.status(400).json({ error: 'TRANSACTION_ID é obrigatório.' });
    }

    if (!eventType || !WEBHOOK_TEST_EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({ 
        error: 'EVENT_TYPE invalido.',
        allowedTypes: WEBHOOK_TEST_EVENT_TYPES,
      });
    }

    const webhookPayload = {
      uuid: transactionId,
      timestamp: new Date().toISOString(),
    };

    if (eventType.includes('erro') && error) {
      webhookPayload.error = {
        message: error.message || 'Erro simulado',
        statusCode: error.statusCode || 500,
      };
    }

    const result = await handleWebhook({ eventType, payload: webhookPayload });

    res.json({ 
      data: {
        processed: true,
        transactionId,
        eventType,
        result,
        mensagem: 'Webhook simulado processado.',
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ 
        error: err.message,
        code: err.code,
      });
    }
    next(err);
  }
}

async function listTestDocuments(req, res, next) {
  try {
    if (isProductionEnvironment()) {
      return res.status(403).json({ error: 'Endpoint de teste bloqueado em produção.' });
    }

    res.json({ 
      data: {
        documentos: TEST_DOCUMENTS,
        total: TEST_DOCUMENTS.length,
        fonte: 'Massa de teste de homologação Serasa PEFIN',
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  testAuth,
  testDebt,
  simulateWebhook,
  listTestDocuments,
};
