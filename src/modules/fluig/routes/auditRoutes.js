const express = require('express');
const { validateAuditPayload, logAuditEvent } = require('../services/auditService');
const { sendAuditMail } = require('../services/mailService');

const router = express.Router();

router.post('/audit', async (req, res, next) => {
  try {
    const payload = validateAuditPayload(req.body);

    logAuditEvent(payload);

    await sendAuditMail({
      subject: payload.subject,
      content: payload.content,
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
