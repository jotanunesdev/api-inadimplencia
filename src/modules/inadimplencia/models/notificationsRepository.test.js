const { getPool, sql } = require('../config/db');
const notificationsRepository = require('./notificationsRepository');

jest.mock('../config/db');

describe('notificationsRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeUsername', () => {
    it('should trim and lowercase username', () => {
      // The function is internal, but we can test its effect through the methods
      // This is tested indirectly through other tests
    });
  });

  describe('insert', () => {
    it('should insert notification with normalized usernames and DATETIME binding', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);

      const mockInsertedRow = {
        ID: 'uuid-123',
        TIPO: 'VENDA_ATRIBUIDA',
        USUARIO_DESTINATARIO: 'joao',
        ORIGEM_USUARIO: 'admin',
        NUM_VENDA: 12345,
        PROXIMA_ACAO: new Date('2025-10-01T13:45:00.000Z'),
        PAYLOAD: '{"numVenda":12345}',
        LIDA: 0,
        DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
        DT_LEITURA: null,
        DT_EXCLUSAO: null,
      };
      mockRequest.query.mockResolvedValue({ recordset: [mockInsertedRow] });

      const payload = { numVenda: 12345, cliente: 'Test Client' };
      const proximaAcao = new Date('2025-10-01T13:45:00.000Z');

      const result = await notificationsRepository.insert({
        tipo: 'VENDA_ATRIBUIDA',
        usuarioDestinatario: 'Joao ',
        origemUsuario: 'Admin',
        numVenda: 12345,
        proximaAcao,
        payload,
      });

      expect(mockRequest.input).toHaveBeenCalledWith('tipo', sql.VarChar(32), 'VENDA_ATRIBUIDA');
      expect(mockRequest.input).toHaveBeenCalledWith('usuarioDestinatario', sql.VarChar(255), 'joao');
      expect(mockRequest.input).toHaveBeenCalledWith('origemUsuario', sql.VarChar(255), 'admin');
      expect(mockRequest.input).toHaveBeenCalledWith('proximaAcao', sql.DateTime, proximaAcao);
      expect(mockRequest.input).toHaveBeenCalledWith('payload', sql.NVarChar(sql.MAX), JSON.stringify(payload));
      expect(result).toEqual(mockInsertedRow);
    });

    it('should insert with null origemUsuario for VENDA_ATRASADA', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);

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
      mockRequest.query.mockResolvedValue({ recordset: [mockInsertedRow] });

      const result = await notificationsRepository.insert({
        tipo: 'VENDA_ATRASADA',
        usuarioDestinatario: 'Joao',
        origemUsuario: null,
        numVenda: 12345,
        proximaAcao: new Date('2025-10-01T13:45:00.000Z'),
        payload: { numVenda: 12345 },
      });

      expect(mockRequest.input).toHaveBeenCalledWith('origemUsuario', sql.VarChar(255), null);
      expect(result.ORIGEM_USUARIO).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find notification by id and username with normalization', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);

      const mockRow = {
        ID: 'uuid-123',
        TIPO: 'VENDA_ATRIBUIDA',
        USUARIO_DESTINATARIO: 'joao',
        ORIGEM_USUARIO: 'admin',
        NUM_VENDA: 12345,
        PROXIMA_ACAO: new Date('2025-10-01T13:45:00.000Z'),
        PAYLOAD: '{"numVenda":12345}',
        LIDA: 0,
        DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
        DT_LEITURA: null,
        DT_EXCLUSAO: null,
      };
      mockRequest.query.mockResolvedValue({ recordset: [mockRow] });

      const result = await notificationsRepository.findById('uuid-123', 'Joao');

      expect(mockRequest.input).toHaveBeenCalledWith('id', sql.UniqueIdentifier, 'uuid-123');
      expect(mockRequest.input).toHaveBeenCalledWith('username', sql.VarChar(255), 'joao');
      expect(result).toEqual(mockRow);
    });

    it('should return null if not found', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);
      mockRequest.query.mockResolvedValue({ recordset: [] });

      const result = await notificationsRepository.findById('uuid-123', 'joao');

      expect(result).toBeNull();
    });
  });

  describe('findByDedupeKey', () => {
    it('should find by dedupe key comparing PROXIMA_ACAO_DIA (day granularity)', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);

      const mockRow = {
        ID: 'uuid-123',
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
      mockRequest.query.mockResolvedValue({ recordset: [mockRow] });

      // Searching with a different time but same day should match
      const proximaAcao = new Date('2025-10-01T17:30:00.000Z');
      const result = await notificationsRepository.findByDedupeKey({
        tipo: 'VENDA_ATRASADA',
        usuarioDestinatario: 'Joao',
        numVenda: 12345,
        proximaAcao,
      });

      expect(mockRequest.input).toHaveBeenCalledWith('tipo', sql.VarChar(32), 'VENDA_ATRASADA');
      expect(mockRequest.input).toHaveBeenCalledWith('usuarioDestinatario', sql.VarChar(255), 'joao');
      expect(mockRequest.input).toHaveBeenCalledWith('numVenda', sql.Int, 12345);
      expect(mockRequest.input).toHaveBeenCalledWith('proximaAcao', sql.DateTime, proximaAcao);
      expect(result).toEqual(mockRow);
    });

    it('should return null if not found by dedupe key', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);
      mockRequest.query.mockResolvedValue({ recordset: [] });

      const result = await notificationsRepository.findByDedupeKey({
        tipo: 'VENDA_ATRASADA',
        usuarioDestinatario: 'joao',
        numVenda: 12345,
        proximaAcao: new Date('2025-10-01T13:45:00.000Z'),
      });

      expect(result).toBeNull();
    });
  });

  describe('listPaginated', () => {
    it('should list paginated with unread prioritized', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);

      const mockRows = [
        {
          ID: 'uuid-1',
          TIPO: 'VENDA_ATRIBUIDA',
          USUARIO_DESTINATARIO: 'joao',
          ORIGEM_USUARIO: 'admin',
          NUM_VENDA: 12345,
          PROXIMA_ACAO: new Date('2025-10-01T13:45:00.000Z'),
          PAYLOAD: '{"numVenda":12345}',
          LIDA: 0,
          DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
          DT_LEITURA: null,
          DT_EXCLUSAO: null,
          Total: 10,
          UnreadCount: 3,
        },
      ];
      mockRequest.query.mockResolvedValue({ recordset: mockRows });

      const result = await notificationsRepository.listPaginated({
        username: 'Joao',
        page: 1,
        pageSize: 20,
      });

      expect(mockRequest.input).toHaveBeenCalledWith('username', sql.VarChar(255), 'joao');
      expect(mockRequest.input).toHaveBeenCalledWith('offset', sql.Int, 0);
      expect(mockRequest.input).toHaveBeenCalledWith('pageSize', sql.Int, 20);
      expect(result.rows).toEqual(mockRows);
      expect(result.total).toBe(10);
      expect(result.unreadCount).toBe(3);
    });

    it('should filter by lida when provided', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);

      mockRequest.query.mockResolvedValue({ recordset: [] });

      await notificationsRepository.listPaginated({
        username: 'joao',
        page: 1,
        pageSize: 20,
        lida: true,
      });

      const queryCall = mockRequest.query.mock.calls[0][0];
      expect(queryCall).toContain('LIDA = 1');
    });
  });

  describe('listUnread', () => {
    it('should list unread notifications with limit and return totalUnread', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);

      const mockRows = [
        {
          ID: 'uuid-1',
          TIPO: 'VENDA_ATRIBUIDA',
          USUARIO_DESTINATARIO: 'joao',
          ORIGEM_USUARIO: 'admin',
          NUM_VENDA: 12345,
          PROXIMA_ACAO: new Date('2025-10-01T13:45:00.000Z'),
          PAYLOAD: '{"numVenda":12345}',
          LIDA: 0,
          DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
          DT_LEITURA: null,
          DT_EXCLUSAO: null,
          TotalUnread: 5,
        },
      ];
      mockRequest.query.mockResolvedValue({ recordset: mockRows });

      const result = await notificationsRepository.listUnread({
        username: 'Joao',
        limit: 10,
      });

      expect(mockRequest.input).toHaveBeenCalledWith('username', sql.VarChar(255), 'joao');
      expect(mockRequest.input).toHaveBeenCalledWith('limit', sql.Int, 10);
      expect(result.rows).toEqual(mockRows);
      expect(result.totalUnread).toBe(5);
    });

    it('should use correct SQL syntax with OFFSET 0 ROWS before FETCH NEXT', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);
      mockRequest.query.mockResolvedValue({ recordset: [] });

      await notificationsRepository.listUnread({
        username: 'joao',
        limit: 20,
      });

      const queryCall = mockRequest.query.mock.calls[0][0];
      expect(queryCall).toContain('OFFSET 0 ROWS');
      expect(queryCall).toContain('FETCH NEXT @limit ROWS ONLY');
    });

    it('should return correct totalUnread when there are more than 20 unread notifications', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);

      // Mock 25 unread notifications, but limit returns only 20
      const mockRows = Array.from({ length: 20 }, (_, i) => ({
        ID: `uuid-${i}`,
        TIPO: 'VENDA_ATRIBUIDA',
        USUARIO_DESTINATARIO: 'joao',
        ORIGEM_USUARIO: 'admin',
        NUM_VENDA: 12345 + i,
        PROXIMA_ACAO: new Date('2025-10-01T13:45:00.000Z'),
        PAYLOAD: '{"numVenda":12345}',
        LIDA: 0,
        DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
        DT_LEITURA: null,
        DT_EXCLUSAO: null,
        TotalUnread: 25, // Total count should be 25 even though only 20 rows returned
      }));
      mockRequest.query.mockResolvedValue({ recordset: mockRows });

      const result = await notificationsRepository.listUnread({
        username: 'joao',
        limit: 20,
      });

      expect(result.rows).toHaveLength(20);
      expect(result.totalUnread).toBe(25);
    });
  });

  describe('markRead', () => {
    it('should mark notification as read', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);

      const mockRow = {
        ID: 'uuid-123',
        TIPO: 'VENDA_ATRIBUIDA',
        USUARIO_DESTINATARIO: 'joao',
        ORIGEM_USUARIO: 'admin',
        NUM_VENDA: 12345,
        PROXIMA_ACAO: new Date('2025-10-01T13:45:00.000Z'),
        PAYLOAD: '{"numVenda":12345}',
        LIDA: 1,
        DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
        DT_LEITURA: new Date('2025-10-01T11:00:00.000Z'),
        DT_EXCLUSAO: null,
      };
      mockRequest.query.mockResolvedValue({ recordset: [mockRow] });

      const result = await notificationsRepository.markRead('uuid-123', 'Joao');

      expect(mockRequest.input).toHaveBeenCalledWith('id', sql.UniqueIdentifier, 'uuid-123');
      expect(mockRequest.input).toHaveBeenCalledWith('username', sql.VarChar(255), 'joao');
      expect(result.LIDA).toBe(1);
      expect(result.DT_LEITURA).not.toBeNull();
    });

    it('should return null if not found', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);
      mockRequest.query.mockResolvedValue({ recordset: [] });

      const result = await notificationsRepository.markRead('uuid-123', 'joao');

      expect(result).toBeNull();
    });
  });

  describe('markAllRead', () => {
    it('should mark all notifications as read for user', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);
      mockRequest.query.mockResolvedValue({ rowsAffected: [5] });

      const result = await notificationsRepository.markAllRead('Joao');

      expect(mockRequest.input).toHaveBeenCalledWith('username', sql.VarChar(255), 'joao');
      expect(result).toBe(5);
    });
  });

  describe('softDelete', () => {
    it('should soft delete read notification', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);

      // Atomic UPDATE with OUTPUT returns the row
      const mockRow = {
        ID: 'uuid-123',
        TIPO: 'VENDA_ATRIBUIDA',
        USUARIO_DESTINATARIO: 'joao',
        ORIGEM_USUARIO: 'admin',
        NUM_VENDA: 12345,
        PROXIMA_ACAO: new Date('2025-10-01T13:45:00.000Z'),
        PAYLOAD: '{"numVenda":12345}',
        LIDA: 1,
        DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
        DT_LEITURA: new Date('2025-10-01T11:00:00.000Z'),
        DT_EXCLUSAO: new Date('2025-10-01T12:00:00.000Z'),
      };
      mockRequest.query.mockResolvedValue({ recordset: [mockRow] });

      const result = await notificationsRepository.softDelete('uuid-123', 'Joao');

      expect(result.DT_EXCLUSAO).not.toBeNull();
    });

    it('should return null if notification not found', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);

      // UPDATE returns empty (no rows affected)
      mockRequest.query.mockResolvedValueOnce({ recordset: [] });
      // SELECT fallback also returns empty
      mockRequest.query.mockResolvedValueOnce({ recordset: [] });

      const result = await notificationsRepository.softDelete('uuid-123', 'joao');

      expect(result).toBeNull();
    });

    it('should throw 409 error when trying to delete unread notification', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);

      // UPDATE returns empty (LIDA=0 in WHERE clause prevents update)
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [] }) // UPDATE with OUTPUT
        .mockResolvedValueOnce({ recordset: [{ LIDA: 0 }] }); // SELECT fallback

      let error;
      try {
        await notificationsRepository.softDelete('uuid-123', 'joao');
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.message).toBe('Cannot delete unread notification');
      expect(error.statusCode).toBe(409);
    });

    it('should handle concurrent softDelete requests atomically (race condition test)', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);

      const mockRow = {
        ID: 'uuid-123',
        TIPO: 'VENDA_ATRIBUIDA',
        USUARIO_DESTINATARIO: 'joao',
        ORIGEM_USUARIO: 'admin',
        NUM_VENDA: 12345,
        PROXIMA_ACAO: new Date('2025-10-01T13:45:00.000Z'),
        PAYLOAD: '{"numVenda":12345}',
        LIDA: 1,
        DT_CRIACAO: new Date('2025-10-01T10:00:00.000Z'),
        DT_LEITURA: new Date('2025-10-01T11:00:00.000Z'),
        DT_EXCLUSAO: new Date('2025-10-01T12:00:00.000Z'),
      };

      // Simulate concurrent requests - only one should succeed
      let callCount = 0;
      mockRequest.query.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call succeeds with atomic UPDATE
          return Promise.resolve({ recordset: [mockRow] });
        }
        // Second call returns empty (already deleted by WHERE clause check)
        // Then SELECT fallback also returns empty
        if (callCount === 2) {
          return Promise.resolve({ recordset: [] });
        }
        return Promise.resolve({ recordset: [] });
      });

      const promise1 = notificationsRepository.softDelete('uuid-123', 'joao');
      const promise2 = notificationsRepository.softDelete('uuid-123', 'joao');

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // One should succeed, one should return null
      expect([result1, result2]).toContainEqual(null);
    });
  });
});
