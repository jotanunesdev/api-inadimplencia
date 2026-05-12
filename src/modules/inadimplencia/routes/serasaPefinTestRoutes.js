const { Router } = require('express');
const {
  testAuth,
  testDebt,
  simulateWebhook,
  listTestDocuments,
} = require('../controllers/serasaPefinTestController');

const router = Router();

/**
 * @route GET /inadimplencia/serasa-pefin/testes/auth
 * @description Testa autenticação com credenciais configuradas
 * @access Test only (blocked in production)
 */
router.get('/auth', testAuth);

/**
 * @route POST /inadimplencia/serasa-pefin/testes/debt
 * @description Envia negativação de teste usando documento da massa de teste
 * @access Test only (blocked in production)
 */
router.post('/debt', testDebt);

/**
 * @route POST /inadimplencia/serasa-pefin/testes/webhook/simular
 * @description Simula webhook de sucesso ou erro manualmente
 * @access Test only (blocked in production)
 */
router.post('/webhook/simular', simulateWebhook);

/**
 * @route GET /inadimplencia/serasa-pefin/testes/documentos
 * @description Lista documentos autorizados pela Serasa para homologação
 * @access Test only (blocked in production)
 */
router.get('/documentos', listTestDocuments);

module.exports = router;
