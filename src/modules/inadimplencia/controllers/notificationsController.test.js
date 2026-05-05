const notificationService = require('../services/notificationService');
const sseHub = require('../services/sseHub');
const controller = require('../controllers/notificationsController');

jest.mock('../services/notificationService');
jest.mock('../services/sseHub');

describe('notificationsController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      query: {},
      params: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('getPaginated', () => {
    it('should return 400 if username is missing', async () => {
      await controller.getPaginated(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'username is required' });
    });

    it('should return paginated notifications', async () => {
      req.query.username = 'joao';
      req.query.page = '1';
      req.query.pageSize = '20';

      const mockResult = {
        page: 1,
        pageSize: 20,
        total: 10,
        unreadCount: 3,
        notifications: [],
      };
      notificationService.getPaginated.mockResolvedValue(mockResult);

      await controller.getPaginated(req, res, next);

      expect(notificationService.getPaginated).toHaveBeenCalledWith({
        username: 'joao',
        page: 1,
        pageSize: 20,
        lida: undefined,
      });
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should parse lida parameter correctly', async () => {
      req.query.username = 'joao';
      req.query.lida = 'true';

      const mockResult = {
        page: 1,
        pageSize: 20,
        total: 10,
        unreadCount: 3,
        notifications: [],
      };
      notificationService.getPaginated.mockResolvedValue(mockResult);

      await controller.getPaginated(req, res, next);

      expect(notificationService.getPaginated).toHaveBeenCalledWith({
        username: 'joao',
        page: 1,
        pageSize: 20,
        lida: true,
      });
    });

    it('should handle errors', async () => {
      req.query.username = 'joao';
      const error = new Error('Service error');
      notificationService.getPaginated.mockRejectedValue(error);

      await controller.getPaginated(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('openStream', () => {
    it('should return 400 if username is missing', async () => {
      await controller.openStream(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'username is required' });
    });

    it('should register SSE client', async () => {
      req.query.username = 'joao';
      sseHub.register.mockResolvedValue();

      await controller.openStream(req, res, next);

      expect(sseHub.register).toHaveBeenCalledWith('joao', res);
    });

    it('should handle errors', async () => {
      req.query.username = 'joao';
      const error = new Error('SSE error');
      sseHub.register.mockRejectedValue(error);

      await controller.openStream(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('markAsRead', () => {
    it('should return 400 if username is missing', async () => {
      req.params.id = 'uuid-123';

      await controller.markAsRead(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'username is required' });
    });

    it('should mark notification as read', async () => {
      req.params.id = 'uuid-123';
      req.query.username = 'joao';

      const mockResult = {
        id: 'uuid-123',
        tipo: 'VENDA_ATRIBUIDA',
        lida: true,
      };
      notificationService.markAsRead.mockResolvedValue(mockResult);

      await controller.markAsRead(req, res, next);

      expect(notificationService.markAsRead).toHaveBeenCalledWith({
        id: 'uuid-123',
        username: 'joao',
      });
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should handle errors', async () => {
      req.params.id = 'uuid-123';
      req.query.username = 'joao';
      const error = new Error('Service error');
      notificationService.markAsRead.mockRejectedValue(error);

      await controller.markAsRead(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('markAllAsRead', () => {
    it('should return 400 if username is missing', async () => {
      await controller.markAllAsRead(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'username is required' });
    });

    it('should mark all notifications as read', async () => {
      req.query.username = 'joao';

      const mockResult = { updated: 5 };
      notificationService.markAllAsRead.mockResolvedValue(mockResult);

      await controller.markAllAsRead(req, res, next);

      expect(notificationService.markAllAsRead).toHaveBeenCalledWith({
        username: 'joao',
      });
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should handle errors', async () => {
      req.query.username = 'joao';
      const error = new Error('Service error');
      notificationService.markAllAsRead.mockRejectedValue(error);

      await controller.markAllAsRead(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('softDelete', () => {
    it('should return 400 if username is missing', async () => {
      req.params.id = 'uuid-123';

      await controller.softDelete(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'username is required' });
    });

    it('should soft delete notification', async () => {
      req.params.id = 'uuid-123';
      req.query.username = 'joao';

      const mockResult = {
        id: 'uuid-123',
        tipo: 'VENDA_ATRIBUIDA',
        deletedAt: '2025-10-01T12:00:00.000Z',
      };
      notificationService.softDelete.mockResolvedValue(mockResult);

      await controller.softDelete(req, res, next);

      expect(notificationService.softDelete).toHaveBeenCalledWith({
        id: 'uuid-123',
        username: 'joao',
      });
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should handle errors', async () => {
      req.params.id = 'uuid-123';
      req.query.username = 'joao';
      const error = new Error('Service error');
      notificationService.softDelete.mockRejectedValue(error);

      await controller.softDelete(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
