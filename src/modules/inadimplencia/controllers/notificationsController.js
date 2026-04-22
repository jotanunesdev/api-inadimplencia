const notificationService = require('../services/notificationService');
const sseHub = require('../services/sseHub');

// GET /notifications?username=<user>&page=<n>&pageSize=<n>&lida=<bool>
async function getPaginated(req, res, next) {
  try {
    const username = req.query.username;
    if (!username) {
      return res.status(400).json({ error: 'username is required' });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 20;
    const lida = req.query.lida !== undefined ? req.query.lida === 'true' : undefined;

    const result = await notificationService.getPaginated({
      username,
      page,
      pageSize,
      lida,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /notifications/stream?username=<user>
async function openStream(req, res, next) {
  try {
    const username = req.query.username;
    if (!username) {
      return res.status(400).json({ error: 'username is required' });
    }

    await sseHub.register(username, res);
  } catch (err) {
    next(err);
  }
}

// PUT /notifications/:id/read?username=<user>
async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;
    const username = req.query.username;

    if (!username) {
      return res.status(400).json({ error: 'username is required' });
    }

    const result = await notificationService.markAsRead({ id, username });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// PUT /notifications/read-all?username=<user>
async function markAllAsRead(req, res, next) {
  try {
    const username = req.query.username;

    if (!username) {
      return res.status(400).json({ error: 'username is required' });
    }

    const result = await notificationService.markAllAsRead({ username });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// DELETE /notifications/:id?username=<user>
async function softDelete(req, res, next) {
  try {
    const { id } = req.params;
    const username = req.query.username;

    if (!username) {
      return res.status(400).json({ error: 'username is required' });
    }

    const result = await notificationService.softDelete({ id, username });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPaginated,
  openStream,
  markAsRead,
  markAllAsRead,
  softDelete,
};