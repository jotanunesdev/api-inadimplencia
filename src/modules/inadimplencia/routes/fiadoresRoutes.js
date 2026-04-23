const express = require('express');
const controller = require('../controllers/fiadoresController');

const router = express.Router();

router.get('/num-venda/:numVenda', controller.getByNumVenda);
router.get('/cpf/:cpf', controller.getByCpf);

module.exports = router;
