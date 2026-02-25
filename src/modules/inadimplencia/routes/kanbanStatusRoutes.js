const express = require('express');
const controller = require('../controllers/kanbanStatusController');

const router = express.Router();

router.get('/', controller.getAll);
router.post('/', controller.upsert);

module.exports = router;
