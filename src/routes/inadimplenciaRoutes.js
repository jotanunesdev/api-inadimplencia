const express = require('express');
const controller = require('../controllers/inadimplenciaController');

const router = express.Router();

router.get('/', controller.getAll);
router.get('/cpf/:cpf', controller.getByCpf);
router.get('/num-venda/:numVenda', controller.getByNumVenda);

module.exports = router;