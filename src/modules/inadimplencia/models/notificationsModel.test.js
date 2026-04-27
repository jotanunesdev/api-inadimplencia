const { getPool, sql } = require('../config/db');
const notificationsModel = require('./notificationsModel');

jest.mock('../config/db');

describe('notificationsModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findOverdueSalesByUsername', () => {
    it('should use the latest kanban row as the source of PROXIMA_ACAO', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);
      mockRequest.query.mockResolvedValue({ recordset: [] });

      await notificationsModel.findOverdueSalesByUsername('Joao');

      expect(mockRequest.input).toHaveBeenCalledWith('username', sql.VarChar(255), 'joao');

      const queryCall = mockRequest.query.mock.calls[0][0];
      expect(queryCall).not.toContain('dbo.OCORRENCIAS');
      expect(queryCall).toContain('UltimoKanban');
      expect(queryCall).toContain('kb.PROXIMA_ACAO');
      expect(queryCall).toContain('CAST(kb.PROXIMA_ACAO AS date) < CAST(GETDATE() AS date)');
    });
  });

  describe('findAllOverdue', () => {
    it('should query overdue sales using the latest kanban row', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);
      mockRequest.query.mockResolvedValue({ recordset: [] });

      await notificationsModel.findAllOverdue();

      const queryCall = mockRequest.query.mock.calls[0][0];
      expect(queryCall).not.toContain('dbo.OCORRENCIAS');
      expect(queryCall).toContain('UltimoKanban');
      expect(queryCall).toContain('kb.PROXIMA_ACAO');
      expect(queryCall).toContain('ORDER BY kb.PROXIMA_ACAO ASC, i.NUM_VENDA ASC');
    });
  });
});
