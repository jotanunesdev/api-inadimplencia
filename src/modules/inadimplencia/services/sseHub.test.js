const notificationService = require('./notificationService');
const sseHub = require('./sseHub');

jest.mock('./notificationService');

describe('sseHub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Clear connections map to prevent state leakage between tests
    sseHub.clearConnections();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('register', () => {
    it('should set SSE headers and send snapshot', async () => {
      const mockRes = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
      };

      const mockSnapshot = {
        page: 1,
        pageSize: 20,
        total: 5,
        unreadCount: 5,
        notifications: [],
      };
      notificationService.getSnapshotForUser.mockResolvedValue(mockSnapshot);

      await sseHub.register('joao', mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-transform');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
      expect(mockRes.flushHeaders).toHaveBeenCalled();
      expect(notificationService.getSnapshotForUser).toHaveBeenCalledWith('joao');
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('event: inadimplencia-notifications.snapshot')
      );
    });

    it('should setup heartbeat every 15s', async () => {
      const mockRes = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
      };

      notificationService.getSnapshotForUser.mockResolvedValue({
        page: 1,
        pageSize: 20,
        total: 0,
        unreadCount: 0,
        notifications: [],
      });

      await sseHub.register('joao', mockRes);

      // Fast-forward 15s
      jest.advanceTimersByTime(15000);

      expect(mockRes.write).toHaveBeenCalledWith(': ping\n\n');
    });

    it('should cleanup on close', async () => {
      const mockRes = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback();
          }
        }),
        end: jest.fn(),
      };

      notificationService.getSnapshotForUser.mockResolvedValue({
        page: 1,
        pageSize: 20,
        total: 0,
        unreadCount: 0,
        notifications: [],
      });

      await sseHub.register('joao', mockRes);

      expect(sseHub.listenerCount('joao')).toBe(0);
    });

    it('should cleanup on error', async () => {
      const mockRes = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            callback();
          }
        }),
        end: jest.fn(),
      };

      notificationService.getSnapshotForUser.mockResolvedValue({
        page: 1,
        pageSize: 20,
        total: 0,
        unreadCount: 0,
        notifications: [],
      });

      await sseHub.register('joao', mockRes);

      expect(sseHub.listenerCount('joao')).toBe(0);
    });
  });

  describe('emitNew', () => {
    it('should broadcast new notification to connected listeners', async () => {
      const mockRes1 = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
      };
      const mockRes2 = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
      };

      notificationService.getSnapshotForUser.mockResolvedValue({
        page: 1,
        pageSize: 20,
        total: 0,
        unreadCount: 0,
        notifications: [],
      });

      await sseHub.register('joao', mockRes1);
      await sseHub.register('joao', mockRes2);

      const notificationDTO = {
        id: 'uuid-123',
        tipo: 'VENDA_ATRIBUIDA',
        type: 'assignment',
        numVenda: 12345,
      };

      sseHub.emitNew('joao', notificationDTO);

      expect(mockRes1.write).toHaveBeenCalledWith(
        expect.stringContaining('event: inadimplencia-notifications.new')
      );
      expect(mockRes2.write).toHaveBeenCalledWith(
        expect.stringContaining('event: inadimplencia-notifications.new')
      );
    });

    it('should not broadcast if no listeners', () => {
      const notificationDTO = { id: 'uuid-123', tipo: 'VENDA_ATRIBUIDA' };

      expect(() => sseHub.emitNew('joao', notificationDTO)).not.toThrow();
    });
  });

  describe('emitUpdate', () => {
    it('should broadcast update to connected listeners', async () => {
      const mockRes = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
      };

      notificationService.getSnapshotForUser.mockResolvedValue({
        page: 1,
        pageSize: 20,
        total: 0,
        unreadCount: 0,
        notifications: [],
      });

      await sseHub.register('joao', mockRes);

      const notificationDTO = {
        id: 'uuid-123',
        tipo: 'VENDA_ATRIBUIDA',
        lida: true,
      };

      sseHub.emitUpdate('joao', notificationDTO);

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('event: inadimplencia-notifications.update')
      );
    });
  });

  describe('listenerCount', () => {
    it('should return 0 when no listeners', () => {
      expect(sseHub.listenerCount('joao')).toBe(0);
    });

    it('should return correct count of listeners', async () => {
      const mockRes1 = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
      };
      const mockRes2 = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
      };

      notificationService.getSnapshotForUser.mockResolvedValue({
        page: 1,
        pageSize: 20,
        total: 0,
        unreadCount: 0,
        notifications: [],
      });

      await sseHub.register('joao', mockRes1);
      await sseHub.register('joao', mockRes2);

      expect(sseHub.listenerCount('joao')).toBe(2);
    });
  });

  describe('safeWrite and cleanup on write failure', () => {
    it('should remove listener on write failure', async () => {
      const mockRes = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(() => {
          throw new Error('Write failed');
        }),
        on: jest.fn(),
        end: jest.fn(),
      };

      notificationService.getSnapshotForUser.mockResolvedValue({
        page: 1,
        pageSize: 20,
        total: 0,
        unreadCount: 0,
        notifications: [],
      });

      await sseHub.register('joao', mockRes);

      const notificationDTO = { id: 'uuid-123', tipo: 'VENDA_ATRIBUIDA' };
      sseHub.emitNew('joao', notificationDTO);

      // Listener should be removed after write failure
      expect(sseHub.listenerCount('joao')).toBe(0);
      expect(mockRes.end).toHaveBeenCalled();
    });
  });

  describe('username normalization', () => {
    it('should normalize usernames case-insensitively', async () => {
      const mockRes1 = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
      };

      notificationService.getSnapshotForUser.mockResolvedValue({
        page: 1,
        pageSize: 20,
        total: 0,
        unreadCount: 0,
        notifications: [],
      });

      await sseHub.register('Joao', mockRes1);

      // Should find the same listener with different case
      expect(sseHub.listenerCount('joao')).toBe(1);
      expect(sseHub.listenerCount('JOAO')).toBe(1);
      expect(sseHub.listenerCount('Joao')).toBe(1);
    });
  });
});
