const express = require('express');
const controller = require('../controllers/atendimentosController');

const router = express.Router();

router.get('/cpf/:cpf', controller.getByCpf);
router.get('/num-venda/:numVenda', controller.getByNumVenda);
router.get('/protocolo/:protocolo', controller.getByProtocolo);
router.post('/', controller.create);

module.exports = router;
