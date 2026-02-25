const express = require('express');
const controller = require('../controllers/relatoriosController');

const router = express.Router();

router.get('/ficha-financeira', controller.getFichaFinanceira);

module.exports = router;
