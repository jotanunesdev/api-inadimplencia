const express = require('express');
const controller = require('../controllers/pm2Controller');

const router = express.Router();

router.get('/health', controller.getHealth);
router.get('/overview', controller.getOverview);
router.get('/ws-info', controller.getWebsocketInfo);
router.get('/processes', controller.getProcesses);
router.get('/processes/:id', controller.getProcessDetails);
router.post('/processes/:id/actions/update', controller.updateProcess);
router.post('/processes/:id/actions/reload', controller.reloadProcess);
router.post('/processes/:id/actions/pause', controller.pauseProcess);
router.delete('/processes/:id', controller.deleteProcess);

module.exports = router;
