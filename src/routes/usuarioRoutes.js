const express = require('express');
const controller = require('../controllers/usuarioController');

const router = express.Router();

router.get('/', controller.getAll);
router.get('/:nome', controller.getByNome);
router.post('/', controller.create);
router.put('/:nome', controller.update);
router.delete('/:nome', controller.remove);

module.exports = router;