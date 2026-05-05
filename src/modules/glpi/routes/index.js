const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { ensureConfigured } = require('../middlewares/ensureConfigured');
const { notFound } = require('../middlewares/notFound');
const { errorHandler } = require('../middlewares/errorHandler');
const { getChamados } = require('../controllers/chamadosController');
const { getInventario } = require('../controllers/inventarioController');
const { getCustos } = require('../controllers/custosController');
const { getHealth } = require('../controllers/healthController');

const router = express.Router();

router.get('/health', asyncHandler(getHealth));
router.get('/chamados', ensureConfigured, asyncHandler(getChamados));
router.get('/inventario', ensureConfigured, asyncHandler(getInventario));
router.get('/custos', ensureConfigured, asyncHandler(getCustos));
router.use(notFound);
router.use(errorHandler);

module.exports = router;
