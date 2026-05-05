const { getPool, sql } = require('../config/db');
const kanbanStatusModel = require('./kanbanStatusModel');

jest.mock('../config/db');

describe('kanbanStatusModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return only the latest status per venda and usuario', async () => {
      const mockRequest = {
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);

      const mockRows = [
        {
          NUM_VENDA_FK: 12345,
          PROXIMA_ACAO: new Date('2026-04-24T10:00:00.000Z'),
          STATUS: 'done',
          STATUS_DATA: '2026-04-24',
          NOME_USUARIO_FK: 'joao',
          DT_ATUALIZACAO: new Date('2026-04-24T10:05:00.000Z'),
        },
      ];
      mockRequest.query.mockResolvedValue({ recordset: mockRows });

      const result = await kanbanStatusModel.findAll();

      expect(result).toEqual(mockRows);
      const queryCall = mockRequest.query.mock.calls[0][0];
      expect(queryCall).toContain('ROW_NUMBER() OVER');
      expect(queryCall).toContain('PARTITION BY ks.NUM_VENDA_FK, ks.NOME_USUARIO_FK');
      expect(queryCall).toContain('WHERE RN = 1');
    });
  });

  describe('findTimedOutInProgress', () => {
    it('should only consider the latest status when expiring inProgress records', async () => {
      const mockRequest = {
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);

      mockRequest.query.mockResolvedValue({ recordset: [{ NUM_VENDA_FK: 12345 }] });

      const result = await kanbanStatusModel.findTimedOutInProgress();

      expect(result).toEqual([{ NUM_VENDA_FK: 12345 }]);
      const queryCall = mockRequest.query.mock.calls[0][0];
      expect(queryCall).toContain('WHERE RN = 1');
      expect(queryCall).toContain("STATUS = 'inProgress'");
      expect(queryCall).toContain(`DATEDIFF(SECOND, DT_ATUALIZACAO, GETDATE()) >= 300`);
    });
  });

  describe('moveTimedOutToTodo', () => {
    it('should update only the latest timed out inProgress row', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);

      mockRequest.query.mockResolvedValue({ rowsAffected: [1] });

      const result = await kanbanStatusModel.moveTimedOutToTodo(12345);

      expect(mockRequest.input).toHaveBeenCalledWith('numVenda', sql.Int, 12345);
      expect(result).toBe(true);

      const queryCall = mockRequest.query.mock.calls[0][0];
      expect(queryCall).toContain('UPDATE target');
      expect(queryCall).toContain('INNER JOIN UltimoKanban uk');
      expect(queryCall).toContain('uk.RN = 1');
      expect(queryCall).toContain("uk.STATUS = 'inProgress'");
      expect(queryCall).toContain(`DATEDIFF(SECOND, uk.DT_ATUALIZACAO, GETDATE()) >= 300`);
    });
  });

  describe('findActiveByNumVenda', () => {
    it('should only return the current inProgress row', async () => {
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(),
      };
      const mockPool = {
        request: jest.fn().mockReturnValue(mockRequest),
      };
      getPool.mockResolvedValue(mockPool);

      const mockRow = {
        NUM_VENDA_FK: 12345,
        PROXIMA_ACAO: new Date('2026-04-24T10:00:00.000Z'),
        STATUS: 'inProgress',
        STATUS_DATA: '2026-04-24',
        NOME_USUARIO_FK: 'joao',
        DT_ATUALIZACAO: new Date('2026-04-24T10:05:00.000Z'),
      };
      mockRequest.query.mockResolvedValue({ recordset: [mockRow] });

      const result = await kanbanStatusModel.findActiveByNumVenda(12345);

      expect(mockRequest.input).toHaveBeenCalledWith('numVenda', sql.Int, 12345);
      expect(result).toEqual(mockRow);
      const queryCall = mockRequest.query.mock.calls[0][0];
      expect(queryCall).toContain('WHERE NUM_VENDA_FK = @numVenda');
      expect(queryCall).toContain('AND RN = 1');
      expect(queryCall).toContain("AND STATUS = 'inProgress'");
    });
  });
});
