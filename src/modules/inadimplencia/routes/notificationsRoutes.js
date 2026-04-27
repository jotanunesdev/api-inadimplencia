const express = require('express');
const router = express.Router();
const controller = require('../controllers/notificationsController');

// GET /notifications?username=<user>&page=<n>&pageSize=<n>&lida=<bool>
router.get('/', controller.getPaginated);

// GET /notifications/stream?username=<user>
router.get('/stream', controller.openStream);

// PUT /notifications/:id/read?username=<user>
router.put('/:id/read', controller.markAsRead);

// PUT /notifications/read-all?username=<user>
router.put('/read-all', controller.markAllAsRead);

// DELETE /notifications/:id?username=<user>
router.delete('/:id', controller.softDelete);

module.exports = router;