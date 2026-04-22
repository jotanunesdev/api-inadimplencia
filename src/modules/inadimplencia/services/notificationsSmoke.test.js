const notificationService = require('./notificationService');
const sseHub = require('./sseHub');
const notificationsRepository = require('../models/notificationsRepository');
const responsavelAssignmentService = require('./responsavelAssignmentService');
const overdueScanner = require('./overdueScanner');

jest.mock('../models/notificationsRepository');
jest.mock('./sseHub');
jest.mock('../models/usuarioModel');
jest.mock('../models/responsavelModel');

describe('Notifications Smoke Tests - Critical Business Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sseHub.clearConnections();
  });

  describe('7.1 Assignment → Persistence → SSE Flow', () => {
    it('should create assignment notification and broadcast via SSE', async () => {
      const mockInsertedRow = {
        ID: 'uuid-123',
        TIPO: 'VENDA_ATRIBUIDA',
        USUARIO_DESTINATARIO: 'joao',
        ORIGEM_USUARIO: 'admin123',
        NUM_VENDA: 12345,
        PROXIMA_ACAO: null,
        PAYLOAD: '{"numVenda":12345,"cliente":"Client A"}',
        LIDA: 0,
        DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
        DT_LEITURA: null,
        DT_EXCLUSAO: null,
      };
      notificationsRepository.insert.mockResolvedValue(mockInsertedRow);
      sseHub.emitNew.mockImplementation(() => {});

      const saleSnapshot = {
        cliente: 'Client A',
        cpfCnpj: '12345678900',
        empreendimento: 'Emp A',
        valorInadimplente: 1000,
        responsavel: 'joao',
        dtAtribuicao: new Date('2025-10-01T10:00:00.000Z'),
      };

      const result = await notificationService.createAssignmentNotification({
        numVenda: 12345,
        destinatario: 'joao',
        adminUserCode: 'admin123',
        saleSnapshot,
      });

      // Validate persistence
      expect(notificationsRepository.insert).toHaveBeenCalledWith({
        tipo: 'VENDA_ATRIBUIDA',
        usuarioDestinatario: 'joao',
        origemUsuario: 'admin123',
        numVenda: 12345,
        proximaAcao: null,
        payload: expect.objectContaining({
          cliente: 'Client A',
        }),
      });

      // Validate SSE broadcast
      expect(sseHub.emitNew).toHaveBeenCalledWith('joao', expect.objectContaining({
        tipo: 'VENDA_ATRIBUIDA',
        type: 'assignment',
        adminUserCode: 'admin123',
      }));

      expect(result.tipo).toBe('VENDA_ATRIBUIDA');
      expect(result.lida).toBe(false);
    });
  });

  describe('7.2 Initial Snapshot and Pagination', () => {
    it('should return snapshot with only unread notifications', async () => {
      const mockRows = [
        {
          ID: 'uuid-1',
          TIPO: 'VENDA_ATRIBUIDA',
          USUARIO_DESTINATARIO: 'joao',
          ORIGEM_USUARIO: 'admin',
          NUM_VENDA: 12345,
          PROXIMA_ACAO: null,
          PAYLOAD: '{}',
          LIDA: 0,
          DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
          DT_LEITURA: null,
          DT_EXCLUSAO: null,
        },
      ];
      notificationsRepository.listUnread.mockResolvedValue(mockRows);

      const snapshot = await notificationService.getSnapshotForUser('joao');

      expect(notificationsRepository.listUnread).toHaveBeenCalledWith({
        username: 'joao',
        limit: 20,
      });

      expect(snapshot.notifications).toHaveLength(1);
      expect(snapshot.notifications[0].lida).toBe(false);
      expect(snapshot.unreadCount).toBe(1);
    });

    it('should support pagination with page and pageSize parameters', async () => {
      const mockRows = [
        {
          ID: 'uuid-1',
          TIPO: 'VENDA_ATRIBUIDA',
          USUARIO_DESTINATARIO: 'joao',
          ORIGEM_USUARIO: 'admin',
          NUM_VENDA: 12345,
          PROXIMA_ACAO: null,
          PAYLOAD: JSON.stringify({ cliente: 'Client A', cpfCnpj: '12345678900', empreendimento: 'Emp A', valorInadimplente: 1000, responsavel: 'joao' }),
          LIDA: 0,
          DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
          DT_LEITURA: null,
          DT_EXCLUSAO: null,
        },
      ];
      notificationsRepository.listPaginated.mockResolvedValue({
        rows: mockRows,
        total: 50,
        unreadCount: 10,
      });

      const result = await notificationService.getPaginated({
        username: 'joao',
        page: 2,
        pageSize: 25,
        lida: false,
      });

      expect(notificationsRepository.listPaginated).toHaveBeenCalledWith({
        username: 'joao',
        page: 2,
        pageSize: 25,
        lida: false,
      });

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(25);
      expect(result.total).toBe(50);
      expect(result.unreadCount).toBe(10);
    });
  });

  describe('7.3 Mark Read, Read-All and Soft Delete Operations', () => {
    it('should mark individual notification as read and emit update', async () => {
      const mockRow = {
        ID: 'uuid-123',
        TIPO: 'VENDA_ATRIBUIDA',
        USUARIO_DESTINATARIO: 'joao',
        ORIGEM_USUARIO: 'admin',
        NUM_VENDA: 12345,
        PROXIMA_ACAO: null,
        PAYLOAD: JSON.stringify({ cliente: 'Client A', cpfCnpj: '12345678900', empreendimento: 'Emp A', valorInadimplente: 1000, responsavel: 'joao' }),
        LIDA: 1,
        DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
        DT_LEITURA: new Date('2025-10-01T11:00:00.000Z'),
        DT_EXCLUSAO: null,
      };
      notificationsRepository.markRead.mockResolvedValue(mockRow);
      sseHub.emitUpdate.mockImplementation(() => {});

      const result = await notificationService.markAsRead({
        id: 'uuid-123',
        username: 'joao',
      });

      expect(notificationsRepository.markRead).toHaveBeenCalledWith('uuid-123', 'joao');
      expect(sseHub.emitUpdate).toHaveBeenCalledWith('joao', expect.objectContaining({
        lida: true,
      }));
      expect(result.lida).toBe(true);
    });

    it('should mark all notifications as read', async () => {
      notificationsRepository.markAllRead.mockResolvedValue(5);
      sseHub.emitUpdate.mockImplementation(() => {});

      const result = await notificationService.markAllAsRead({ username: 'joao' });

      expect(notificationsRepository.markAllRead).toHaveBeenCalledWith('joao');
      expect(sseHub.emitUpdate).toHaveBeenCalledWith('joao', { type: 'read_all', updated: 5 });
      expect(result.updated).toBe(5);
    });

    it('should soft delete read notification', async () => {
      const mockRow = {
        ID: 'uuid-123',
        TIPO: 'VENDA_ATRIBUIDA',
        USUARIO_DESTINATARIO: 'joao',
        ORIGEM_USUARIO: 'admin',
        NUM_VENDA: 12345,
        PROXIMA_ACAO: null,
        PAYLOAD: JSON.stringify({ cliente: 'Client A', cpfCnpj: '12345678900', empreendimento: 'Emp A', valorInadimplente: 1000, responsavel: 'joao' }),
        LIDA: 1,
        DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
        DT_LEITURA: new Date('2025-10-01T11:00:00.000Z'),
        DT_EXCLUSAO: new Date('2025-10-01T12:00:00.000Z'),
      };
      notificationsRepository.softDelete.mockResolvedValue(mockRow);
      sseHub.emitUpdate.mockImplementation(() => {});

      const result = await notificationService.softDelete({
        id: 'uuid-123',
        username: 'joao',
      });

      expect(notificationsRepository.softDelete).toHaveBeenCalledWith('uuid-123', 'joao');
      expect(result.deletedAt).not.toBeNull();
    });

    it('should throw 409 when trying to delete unread notification', async () => {
      const error = new Error('Cannot delete unread notification');
      error.statusCode = 409;
      notificationsRepository.softDelete.mockRejectedValue(error);

      await expect(notificationService.softDelete({
        id: 'uuid-123',
        username: 'joao',
      })).rejects.toThrow('Cannot delete unread notification');
    });
  });

  describe('7.4 Daily Dedupe of Overdue Notifications', () => {
    it('should dedupe overdue notifications by PROXIMA_ACAO_DIA and user', async () => {
      const mockExistingRow = {
        ID: 'uuid-456',
        TIPO: 'VENDA_ATRASADA',
        USUARIO_DESTINATARIO: 'joao',
        NUM_VENDA: 12345,
        PROXIMA_ACAO: new Date('2025-10-01T08:00:00.000Z'),
      };
      notificationsRepository.findByDedupeKey.mockResolvedValue(mockExistingRow);

      const saleSnapshot = {
        numVenda: 12345,
        cliente: 'Client A',
        proximaAcao: new Date('2025-10-01T17:30:00.000Z'), // Different time, same day
      };

      const result = await notificationService.createOverdueNotification({
        destinatario: 'joao',
        saleSnapshot,
      });

      // Should return null (deduped)
      expect(result).toBeNull();
      expect(notificationsRepository.insert).not.toHaveBeenCalled();
    });

    it('should reemit when PROXIMA_ACAO changes to a different day', async () => {
      notificationsRepository.findByDedupeKey.mockResolvedValue(null);

      const mockInsertedRow = {
        ID: 'uuid-456',
        TIPO: 'VENDA_ATRASADA',
        USUARIO_DESTINATARIO: 'joao',
        ORIGEM_USUARIO: null,
        NUM_VENDA: 12345,
        PROXIMA_ACAO: new Date('2025-10-02T10:00:00.000Z'),
        PAYLOAD: JSON.stringify({ numVenda: 12345, cliente: 'Client A', cpfCnpj: '12345678900', empreendimento: 'Emp A', valorInadimplente: 1000, responsavel: 'joao' }),
        LIDA: 0,
        DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
        DT_LEITURA: null,
        DT_EXCLUSAO: null,
      };
      notificationsRepository.insert.mockResolvedValue(mockInsertedRow);
      sseHub.emitNew.mockImplementation(() => {});

      const saleSnapshot = {
        numVenda: 12345,
        cliente: 'Client A',
        proximaAcao: new Date('2025-10-02T10:00:00.000Z'), // Different day
      };

      const result = await notificationService.createOverdueNotification({
        destinatario: 'joao',
        saleSnapshot,
      });

      // Should create notification (different day)
      expect(result).not.toBeNull();
      expect(notificationsRepository.insert).toHaveBeenCalled();
    });
  });

  // Note: Integration tests with responsavelAssignmentService and overdueScanner
  // have dedicated test files. These smoke tests focus on notificationService core functionality.
});
