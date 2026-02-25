const express = require('express');
const controller = require('../controllers/dashboardController');

const router = express.Router();

router.get('/kpis', controller.getKpis);
router.get('/vendas-por-responsavel', controller.getVendasPorResponsavel);
router.get('/inadimplencia-por-empreendimento', controller.getInadimplenciaPorEmpreendimento);
router.get('/clientes-por-empreendimento', controller.getClientesPorEmpreendimento);
router.get('/status-repasse', controller.getStatusRepasse);
router.get('/blocos', controller.getBlocos);
router.get('/unidades', controller.getUnidades);
router.get('/usuarios-ativos', controller.getUsuariosAtivos);
router.get('/ocorrencias-por-usuario', controller.getOcorrenciasPorUsuario);
router.get('/ocorrencias-por-venda', controller.getOcorrenciasPorVenda);
router.get('/ocorrencias-por-dia', controller.getOcorrenciasPorDia);
router.get('/ocorrencias-por-hora', controller.getOcorrenciasPorHora);
router.get('/ocorrencias-por-dia-hora', controller.getOcorrenciasPorDiaHora);
router.get('/proximas-acoes-por-dia', controller.getProximasAcoesPorDia);
router.get('/acoes-definidas', controller.getAcoesDefinidas);
router.get('/aging', controller.getAging);
router.get('/parcelas-inadimplentes', controller.getParcelasInadimplentes);
router.get('/parcelas-detalhes', controller.getParcelasDetalhes);
router.get('/score-saldo', controller.getScoreSaldo);
router.get('/score-saldo-detalhes', controller.getScoreSaldoDetalhes);
router.get('/saldo-por-mes-vencimento', controller.getSaldoPorMesVencimento);
router.get('/perfil-risco-empreendimento', controller.getPerfilRiscoEmpreendimento);
router.get('/atendentes-proxima-acao', controller.getAtendentesProximaAcao);
router.get('/aging-detalhes', controller.getAgingDetalhes);

module.exports = router;
