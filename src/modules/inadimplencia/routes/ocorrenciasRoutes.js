const express = require('express');
const controller = require('../controllers/ocorrenciasController');

const router = express.Router();

router.get('/', controller.getAll);
router.get('/num-venda/:numVenda', controller.getByNumVenda);
router.get('/protocolo/:protocolo', controller.getByProtocolo);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
