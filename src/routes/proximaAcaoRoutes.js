const express = require('express');
const controller = require('../controllers/proximaAcaoController');

const router = express.Router();

router.get('/', controller.getAll);
router.get('/:numVenda', controller.getByNumVenda);
router.post('/', controller.create);
router.put('/:numVenda', controller.update);
router.delete('/:numVenda', controller.remove);

module.exports = router;