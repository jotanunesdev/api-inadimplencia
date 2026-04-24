const { findAllOverdue } = require('../models/notificationsModel');
const notificationService = require('./notificationService');
const overdueScanner = require('./overdueScanner');

jest.mock('../models/notificationsModel');
jest.mock('./notificationService');

describe('overdueScanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset scanner state by calling stop
    try {
      overdueScanner.stop();
    } catch (e) {
      // Ignore
    }
  });

  describe('tick', () => {
    it('should process overdue sales and create notifications', async () => {
      const mockOverdueSales = [
        {
          NUM_VENDA: 12345,
          CLIENTE: 'Client A',
          CPF_CNPJ: '12345678900',
          EMPREENDIMENTO: 'Emp A',
          VALOR_INADIMPLENTE: 1000,
          SCORE: 76,
          RESPONSAVEL: 'joao',
          PROXIMA_ACAO: new Date('2025-10-01T13:45:00.000Z'),
          KANBAN_STATUS: 'todo',
        },
      ];
      findAllOverdue.mockResolvedValue(mockOverdueSales);
      notificationService.createOverdueNotification.mockResolvedValue({ id: 'uuid-123' });

      await overdueScanner.tick();

      expect(findAllOverdue).toHaveBeenCalled();
      expect(notificationService.createOverdueNotification).toHaveBeenCalledWith({
        destinatario: 'joao',
        saleSnapshot: expect.objectContaining({
          numVenda: 12345,
          cliente: 'Client A',
          score: 76,
        }),
      });
    });

    it('should skip if already running (re-entrancy guard)', async () => {
      let isRunning = false;
      findAllOverdue.mockImplementation(async () => {
        if (isRunning) {
          throw new Error('Should not be called concurrently');
        }
        isRunning = true;
        await new Promise(resolve => setTimeout(resolve, 50));
        isRunning = false;
        return [];
      });

      const promise1 = overdueScanner.tick();
      await new Promise(resolve => setTimeout(resolve, 10));
      const promise2 = overdueScanner.tick();

      await Promise.all([promise1, promise2]);

      // Should only be called once due to re-entrancy guard
      expect(findAllOverdue).toHaveBeenCalledTimes(1);
    });

    it('should handle deduped notifications', async () => {
      const mockOverdueSales = [
        {
          NUM_VENDA: 12345,
          CLIENTE: 'Client A',
          CPF_CNPJ: '12345678900',
          EMPREENDIMENTO: 'Emp A',
          VALOR_INADIMPLENTE: 1000,
          SCORE: 76,
          RESPONSAVEL: 'joao',
          PROXIMA_ACAO: new Date('2025-10-01T13:45:00.000Z'),
          KANBAN_STATUS: 'todo',
        },
      ];
      findAllOverdue.mockResolvedValue(mockOverdueSales);
      notificationService.createOverdueNotification.mockResolvedValue(null); // Deduped

      await overdueScanner.tick();

      expect(notificationService.createOverdueNotification).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      findAllOverdue.mockRejectedValue(new Error('DB Error'));

      await overdueScanner.tick();

      // Should not throw, just log error
      expect(findAllOverdue).toHaveBeenCalled();
    });

    it('should skip sales without responsavel', async () => {
      const mockOverdueSales = [
        {
          NUM_VENDA: 12345,
          CLIENTE: 'Client A',
          CPF_CNPJ: '12345678900',
          EMPREENDIMENTO: 'Emp A',
          VALOR_INADIMPLENTE: 1000,
          SCORE: 76,
          RESPONSAVEL: null, // No responsavel
          PROXIMA_ACAO: new Date('2025-10-01T13:45:00.000Z'),
          KANBAN_STATUS: 'todo',
        },
      ];
      findAllOverdue.mockResolvedValue(mockOverdueSales);

      await overdueScanner.tick();

      expect(notificationService.createOverdueNotification).not.toHaveBeenCalled();
    });
  });

  describe('start and stop', () => {
    it('should start and stop the scanner', () => {
      // Test that start/stop don't throw
      expect(() => overdueScanner.start()).not.toThrow();
      expect(() => overdueScanner.stop()).not.toThrow();
    });

    it('should be safe to call stop when not running', () => {
      expect(() => overdueScanner.stop()).not.toThrow();
    });
  });
});
