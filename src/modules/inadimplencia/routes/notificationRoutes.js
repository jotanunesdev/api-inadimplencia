const express = require('express');
const router = express.Router();
const controller = require('../controllers/notificationsController');

router.get('/', controller.getSnapshot);
router.get('/stream', controller.openStream);

module.exports = router;