const express = require('express');
const controller = require('../controllers/serasaPefinController');

const router = express.Router();

// Preview de dados para negativacao
router.get('/vendas/:numVenda/preview', controller.getPreview);

// Solicitar negativacao (divida principal + garantidores)
router.post('/vendas/:numVenda/negativacoes', controller.postNegativacao);

// Historico de negativacoes por venda
router.get('/vendas/:numVenda/negativacoes', controller.listNegativacoes);

// Acompanhamento por transactionId/uuid retornado pela Serasa
router.get('/acompanhamento/:transactionId', controller.getAcompanhamentoByTransactionId);

// Detalhe de uma negativacao por ID
router.get('/negativacoes/:id', controller.getNegativacaoById);

// Webhooks de inclusao (divida principal)
router.post('/webhooks/inclusao/sucesso', controller.handleWebhookInclusaoSucesso);
router.post('/webhooks/inclusao/erro', controller.handleWebhookInclusaoErro);

// Webhooks de avalista/fiador
router.post('/webhooks/avalista/sucesso', controller.handleWebhookAvalistaSucesso);
router.post('/webhooks/avalista/erro', controller.handleWebhookAvalistaErro);

// Webhooks de baixa/exclusao
router.post('/webhooks/baixa/sucesso', controller.handleWebhookBaixaSucesso);
router.post('/webhooks/baixa/erro', controller.handleWebhookBaixaErro);

module.exports = router;
