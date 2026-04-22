const notificationsRepository = require('../models/notificationsRepository');
const sseHub = require('./sseHub');
const notificationService = require('./notificationService');

jest.mock('../models/notificationsRepository');
jest.mock('./sseHub');

describe('notificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAssignmentNotification', () => {
    it('should persist then broadcast assignment notification', async () => {
      const mockInsertedRow = {
        ID: 'uuid-123',
        TIPO: 'VENDA_ATRIBUIDA',
        USUARIO_DESTINATARIO: 'joao',
        ORIGEM_USUARIO: 'admin',
        NUM_VENDA: 12345,
        PROXIMA_ACAO: null,
        PAYLOAD: '{"numVenda":12345,"cliente":"Test Client"}',
        LIDA: 0,
        DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
        DT_LEITURA: null,
        DT_EXCLUSAO: null,
      };
      notificationsRepository.insert.mockResolvedValue(mockInsertedRow);
      sseHub.emitNew.mockImplementation(() => {});

      const saleSnapshot = {
        cliente: 'Test Client',
        cpfCnpj: '12345678900',
        empreendimento: 'Empreendimento A',
        valorInadimplente: 1000,
        responsavel: 'joao',
        dtAtribuicao: new Date('2025-10-01T10:00:00.000Z'),
      };

      const result = await notificationService.createAssignmentNotification({
        numVenda: 12345,
        destinatario: 'Joao',
        adminUserCode: 'Admin',
        saleSnapshot,
      });

      expect(notificationsRepository.insert).toHaveBeenCalledWith({
        tipo: 'VENDA_ATRIBUIDA',
        usuarioDestinatario: 'Joao',
        origemUsuario: 'Admin',
        numVenda: 12345,
        proximaAcao: null,
        payload: {
          numVenda: 12345,
          cliente: 'Test Client',
          cpfCnpj: '12345678900',
          empreendimento: 'Empreendimento A',
          valorInadimplente: 1000,
          responsavel: 'joao',
          dtAtribuicao: saleSnapshot.dtAtribuicao,
        },
      });

      expect(sseHub.emitNew).toHaveBeenCalledWith('joao', expect.objectContaining({
        tipo: 'VENDA_ATRIBUIDA',
        type: 'assignment',
        adminUserCode: 'admin',
      }));

      expect(result.tipo).toBe('VENDA_ATRIBUIDA');
      expect(result.adminUserCode).toBe('admin');
    });

    it('should not broadcast if insert fails', async () => {
      notificationsRepository.insert.mockRejectedValue(new Error('DB Error'));
      sseHub.emitNew.mockImplementation(() => {});

      const saleSnapshot = {
        cliente: 'Test Client',
        cpfCnpj: '12345678900',
        empreendimento: 'Empreendimento A',
        valorInadimplente: 1000,
        responsavel: 'joao',
        dtAtribuicao: new Date('2025-10-01T10:00:00.000Z'),
      };

      await expect(notificationService.createAssignmentNotification({
        numVenda: 12345,
        destinatario: 'joao',
        adminUserCode: 'admin',
        saleSnapshot,
      })).rejects.toThrow('DB Error');

      expect(sseHub.emitNew).not.toHaveBeenCalled();
    });
  });

  describe('createOverdueNotification', () => {
    it('should persist then broadcast overdue notification when not deduped', async () => {
      notificationsRepository.findByDedupeKey.mockResolvedValue(null);
      
      const mockInsertedRow = {
        ID: 'uuid-456',
        TIPO: 'VENDA_ATRASADA',
        USUARIO_DESTINATARIO: 'joao',
        ORIGEM_USUARIO: null,
        NUM_VENDA: 12345,
        PROXIMA_ACAO: new Date('2025-10-01T13:45:00.000Z'),
        PAYLOAD: '{"numVenda":12345}',
        LIDA: 0,
        DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
        DT_LEITURA: null,
        DT_EXCLUSAO: null,
      };
      notificationsRepository.insert.mockResolvedValue(mockInsertedRow);
      sseHub.emitNew.mockImplementation(() => {});

      const saleSnapshot = {
        numVenda: 12345,
        cliente: 'Test Client',
        cpfCnpj: '12345678900',
        empreendimento: 'Empreendimento A',
        valorInadimplente: 1000,
        responsavel: 'joao',
        proximaAcao: new Date('2025-10-01T13:45:00.000Z'),
        statusKanban: 'todo',
      };

      const result = await notificationService.createOverdueNotification({
        destinatario: 'Joao',
        saleSnapshot,
      });

      expect(notificationsRepository.findByDedupeKey).toHaveBeenCalledWith({
        tipo: 'VENDA_ATRASADA',
        usuarioDestinatario: 'Joao',
        numVenda: 12345,
        proximaAcao: saleSnapshot.proximaAcao,
      });

      expect(notificationsRepository.insert).toHaveBeenCalledWith({
        tipo: 'VENDA_ATRASADA',
        usuarioDestinatario: 'Joao',
        origemUsuario: null,
        numVenda: 12345,
        proximaAcao: saleSnapshot.proximaAcao,
        payload: expect.objectContaining({ numVenda: 12345 }),
      });

      expect(sseHub.emitNew).toHaveBeenCalled();
      expect(result.tipo).toBe('VENDA_ATRASADA');
      expect(result.adminUserCode).toBeNull();
    });

    it('should return null when deduped (same day)', async () => {
      const mockExistingRow = {
        ID: 'uuid-456',
        TIPO: 'VENDA_ATRASADA',
        USUARIO_DESTINATARIO: 'joao',
        ORIGEM_USUARIO: null,
        NUM_VENDA: 12345,
        PROXIMA_ACAO: new Date('2025-10-01T08:00:00.000Z'),
        PAYLOAD: '{"numVenda":12345}',
        LIDA: 0,
        DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
        DT_LEITURA: null,
        DT_EXCLUSAO: null,
      };
      notificationsRepository.findByDedupeKey.mockResolvedValue(mockExistingRow);

      const saleSnapshot = {
        numVenda: 12345,
        cliente: 'Test Client',
        cpfCnpj: '12345678900',
        empreendimento: 'Empreendimento A',
        valorInadimplente: 1000,
        responsavel: 'joao',
        proximaAcao: new Date('2025-10-01T17:30:00.000Z'), // Different time, same day
        statusKanban: 'todo',
      };

      const result = await notificationService.createOverdueNotification({
        destinatario: 'joao',
        saleSnapshot,
      });

      expect(result).toBeNull();
      expect(notificationsRepository.insert).not.toHaveBeenCalled();
      expect(sseHub.emitNew).not.toHaveBeenCalled();
    });

    it('should serialize concurrent calls with mutex', async () => {
      notificationsRepository.findByDedupeKey.mockImplementation(() => {
        return new Promise(resolve => setTimeout(() => resolve(null), 100));
      });
      notificationsRepository.insert.mockResolvedValue({
        ID: 'uuid-456',
        TIPO: 'VENDA_ATRASADA',
        USUARIO_DESTINATARIO: 'joao',
        ORIGEM_USUARIO: null,
        NUM_VENDA: 12345,
        PROXIMA_ACAO: new Date('2025-10-01T13:45:00.000Z'),
        PAYLOAD: '{}',
        LIDA: 0,
        DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
        DT_LEITURA: null,
        DT_EXCLUSAO: null,
      });
      sseHub.emitNew.mockImplementation(() => {});

      const saleSnapshot = {
        numVenda: 12345,
        cliente: 'Test Client',
        cpfCnpj: '12345678900',
        empreendimento: 'Empreendimento A',
        valorInadimplente: 1000,
        responsavel: 'joao',
        proximaAcao: new Date('2025-10-01T13:45:00.000Z'),
        statusKanban: 'todo',
      };

      const promise1 = notificationService.createOverdueNotification({
        destinatario: 'joao',
        saleSnapshot,
      });

      const promise2 = notificationService.createOverdueNotification({
        destinatario: 'joao',
        saleSnapshot,
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // One should succeed, one should return null due to mutex
      expect([result1, result2]).toContainEqual(null);
      expect(notificationsRepository.insert).toHaveBeenCalledTimes(1);
    });

    it('should normalize username in mutex key for concurrent calls with different cases', async () => {
      notificationsRepository.findByDedupeKey.mockImplementation(() => {
        return new Promise(resolve => setTimeout(() => resolve(null), 100));
      });
      notificationsRepository.insert.mockResolvedValue({
        ID: 'uuid-456',
        TIPO: 'VENDA_ATRASADA',
        USUARIO_DESTINATARIO: 'joao',
        ORIGEM_USUARIO: null,
        NUM_VENDA: 12345,
        PROXIMA_ACAO: new Date('2025-10-01T13:45:00.000Z'),
        PAYLOAD: '{}',
        LIDA: 0,
        DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
        DT_LEITURA: null,
        DT_EXCLUSAO: null,
      });
      sseHub.emitNew.mockImplementation(() => {});

      const saleSnapshot = {
        numVenda: 12345,
        cliente: 'Test Client',
        cpfCnpj: '12345678900',
        empreendimento: 'Empreendimento A',
        valorInadimplente: 1000,
        responsavel: 'joao',
        proximaAcao: new Date('2025-10-01T13:45:00.000Z'),
        statusKanban: 'todo',
      };

      // Concurrent calls with different username cases should generate the same mutex key
      const promise1 = notificationService.createOverdueNotification({
        destinatario: 'Joao',
        saleSnapshot,
      });

      const promise2 = notificationService.createOverdueNotification({
        destinatario: 'joao',
        saleSnapshot,
      });

      const promise3 = notificationService.createOverdueNotification({
        destinatario: 'JOAO',
        saleSnapshot,
      });

      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

      // Only one should succeed due to mutex deduplication
      const successCount = [result1, result2, result3].filter(r => r !== null).length;
      expect(successCount).toBe(1);
      expect(notificationsRepository.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read and emit update', async () => {
      const mockRow = {
        ID: 'uuid-123',
        TIPO: 'VENDA_ATRIBUIDA',
        USUARIO_DESTINATARIO: 'joao',
        ORIGEM_USUARIO: 'admin',
        NUM_VENDA: 12345,
        PROXIMA_ACAO: null,
        PAYLOAD: '{}',
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
      expect(sseHub.emitUpdate).toHaveBeenCalledWith('joao', expect.objectContaining({ lida: true }));
      expect(result.lida).toBe(true);
    });

    it('should throw 404 if notification not found', async () => {
      notificationsRepository.markRead.mockResolvedValue(null);

      await expect(notificationService.markAsRead({
        id: 'uuid-123',
        username: 'joao',
      })).rejects.toThrow('Notification not found');

      try {
        await notificationService.markAsRead({ id: 'uuid-123', username: 'joao' });
      } catch (error) {
        expect(error.statusCode).toBe(404);
      }
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all as read and emit update', async () => {
      notificationsRepository.markAllRead.mockResolvedValue(5);
      sseHub.emitUpdate.mockImplementation(() => {});

      const result = await notificationService.markAllAsRead({ username: 'joao' });

      expect(notificationsRepository.markAllRead).toHaveBeenCalledWith('joao');
      expect(sseHub.emitUpdate).toHaveBeenCalledWith('joao', { type: 'read_all', updated: 5 });
      expect(result.updated).toBe(5);
    });
  });

  describe('softDelete', () => {
    it('should soft delete read notification and emit update', async () => {
      const mockRow = {
        ID: 'uuid-123',
        TIPO: 'VENDA_ATRIBUIDA',
        USUARIO_DESTINATARIO: 'joao',
        ORIGEM_USUARIO: 'admin',
        NUM_VENDA: 12345,
        PROXIMA_ACAO: null,
        PAYLOAD: '{}',
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
      expect(sseHub.emitUpdate).toHaveBeenCalled();
      expect(result.deletedAt).not.toBeNull();
    });

    it('should throw 404 if notification not found', async () => {
      notificationsRepository.softDelete.mockResolvedValue(null);

      await expect(notificationService.softDelete({
        id: 'uuid-123',
        username: 'joao',
      })).rejects.toThrow('Notification not found');

      try {
        await notificationService.softDelete({ id: 'uuid-123', username: 'joao' });
      } catch (error) {
        expect(error.statusCode).toBe(404);
      }
    });

    it('should throw 409 if trying to delete unread notification', async () => {
      const error = new Error('Cannot delete unread notification');
      error.statusCode = 409;
      notificationsRepository.softDelete.mockRejectedValue(error);

      await expect(notificationService.softDelete({
        id: 'uuid-123',
        username: 'joao',
      })).rejects.toThrow('Cannot delete unread notification');

      try {
        await notificationService.softDelete({ id: 'uuid-123', username: 'joao' });
      } catch (err) {
        expect(err.statusCode).toBe(409);
      }
    });

    it('should not mask real SSE emit errors', async () => {
      const mockRow = {
        ID: 'uuid-123',
        TIPO: 'VENDA_ATRIBUIDA',
        USUARIO_DESTINATARIO: 'joao',
        ORIGEM_USUARIO: 'admin',
        NUM_VENDA: 12345,
        PROXIMA_ACAO: null,
        PAYLOAD: '{}',
        LIDA: 1,
        DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
        DT_LEITURA: new Date('2025-10-01T11:00:00.000Z'),
        DT_EXCLUSAO: new Date('2025-10-01T12:00:00.000Z'),
      };
      notificationsRepository.softDelete.mockResolvedValue(mockRow);
      const sseError = new Error('SSE connection lost');
      sseHub.emitUpdate.mockImplementation(() => { throw sseError; });

      await expect(notificationService.softDelete({
        id: 'uuid-123',
        username: 'joao',
      })).rejects.toThrow('SSE connection lost');

      try {
        await notificationService.softDelete({ id: 'uuid-123', username: 'joao' });
      } catch (err) {
        expect(err.message).toBe('SSE connection lost');
      }
    });
  });

  describe('getPaginated', () => {
    it('should return paginated notifications', async () => {
      const mockRows = [
        {
          ID: 'uuid-1',
          TIPO: 'VENDA_ATRIBUIDA',
          USUARIO_DESTINATARIO: 'joao',
          ORIGEM_USUARIO: 'admin',
          NUM_VENDA: 12345,
          PROXIMA_ACAO: null,
          PAYLOAD: '{"numVenda":12345}',
          LIDA: 0,
          DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
          DT_LEITURA: null,
          DT_EXCLUSAO: null,
          Total: 10,
          UnreadCount: 3,
        },
      ];
      notificationsRepository.listPaginated.mockResolvedValue({
        rows: mockRows,
        total: 10,
        unreadCount: 3,
      });

      const result = await notificationService.getPaginated({
        username: 'joao',
        page: 1,
        pageSize: 20,
      });

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.total).toBe(10);
      expect(result.unreadCount).toBe(3);
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].tipo).toBe('VENDA_ATRIBUIDA');
    });
  });

  describe('getSnapshotForUser', () => {
    it('should return snapshot of unread notifications with correct totalUnread', async () => {
      const mockRows = [
        {
          ID: 'uuid-1',
          TIPO: 'VENDA_ATRIBUIDA',
          USUARIO_DESTINATARIO: 'joao',
          ORIGEM_USUARIO: 'admin',
          NUM_VENDA: 12345,
          PROXIMA_ACAO: null,
          PAYLOAD: '{"numVenda":12345}',
          LIDA: 0,
          DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
          DT_LEITURA: null,
          DT_EXCLUSAO: null,
        },
      ];
      notificationsRepository.listUnread.mockResolvedValue({
        rows: mockRows,
        totalUnread: 1,
      });

      const result = await notificationService.getSnapshotForUser('joao');

      expect(notificationsRepository.listUnread).toHaveBeenCalledWith({
        username: 'joao',
        limit: 20,
      });
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.total).toBe(1);
      expect(result.unreadCount).toBe(1);
      expect(result.notifications).toHaveLength(1);
    });

    it('should return correct total and unreadCount when there are more than 20 unread notifications', async () => {
      const mockRows = Array.from({ length: 20 }, (_, i) => ({
        ID: `uuid-${i}`,
        TIPO: 'VENDA_ATRIBUIDA',
        USUARIO_DESTINATARIO: 'joao',
        ORIGEM_USUARIO: 'admin',
        NUM_VENDA: 12345 + i,
        PROXIMA_ACAO: null,
        PAYLOAD: '{"numVenda":12345}',
        LIDA: 0,
        DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
        DT_LEITURA: null,
        DT_EXCLUSAO: null,
      }));
      notificationsRepository.listUnread.mockResolvedValue({
        rows: mockRows,
        totalUnread: 25, // More than the 20 rows returned
      });

      const result = await notificationService.getSnapshotForUser('joao');

      expect(result.total).toBe(25);
      expect(result.unreadCount).toBe(25);
      expect(result.notifications).toHaveLength(20); // Only 20 returned due to limit
    });
  });
});
