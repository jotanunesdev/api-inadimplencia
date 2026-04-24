const model = require('../models/ocorrenciasModel');
const responsavelModel = require('../models/responsavelModel');
const notificationService = require('../services/notificationService');
const controller = require('./ocorrenciasController');

jest.mock('../models/ocorrenciasModel');
jest.mock('../models/responsavelModel');
jest.mock('../services/notificationService');

describe('ocorrenciasController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should clear overdue notifications when the new proximaAcao is current or future', async () => {
      model.validateNumVendaFk.mockResolvedValue({ exists: true });
      model.create.mockResolvedValue({
        ID: 'uuid-1',
        NUM_VENDA_FK: 12345,
        NOME_USUARIO_FK: 'joao',
        PROXIMA_ACAO: new Date('2026-04-25T10:00:00.000Z'),
      });
      responsavelModel.findByNumVenda.mockResolvedValue({
        NOME_USUARIO_FK: 'joao',
      });
      notificationService.clearOverdueNotificationsForSale.mockResolvedValue([]);

      const req = {
        body: {
          numVenda: 12345,
          nomeUsuario: 'joao',
          descricao: 'Atendimento concluido',
          statusOcorrencia: 'finalizado',
          dtOcorrencia: '2026-04-24',
          horaOcorrencia: '10:00:00',
          proximaAcao: '2026-04-25',
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await controller.create(req, res, next);

      expect(model.validateNumVendaFk).toHaveBeenCalledWith(12345);
      expect(model.create).toHaveBeenCalledWith(expect.objectContaining({
        numVendaFk: 12345,
        nomeUsuario: 'joao',
        proximaAcao: '2026-04-25',
      }));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(notificationService.clearOverdueNotificationsForSale).toHaveBeenCalledWith({
        numVenda: 12345,
        username: 'joao',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should clear overdue notifications after updating to a future proximaAcao', async () => {
      model.validateNumVendaFk.mockResolvedValue({ exists: true });
      model.update.mockResolvedValue({
        ID: 'uuid-2',
        NUM_VENDA_FK: 12345,
        NOME_USUARIO_FK: 'joao',
        PROXIMA_ACAO: new Date('2026-04-25T10:00:00.000Z'),
      });
      responsavelModel.findByNumVenda.mockResolvedValue({
        NOME_USUARIO_FK: 'joao',
      });
      notificationService.clearOverdueNotificationsForSale.mockResolvedValue([]);

      const req = {
        params: { id: '123e4567-e89b-12d3-a456-426614174000' },
        body: {
          numVenda: 12345,
          nomeUsuario: 'joao',
          descricao: 'Atendimento concluido',
          statusOcorrencia: 'finalizado',
          dtOcorrencia: '2026-04-24',
          horaOcorrencia: '10:00:00',
          proximaAcao: '2026-04-25',
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await controller.update(req, res, next);

      expect(model.update).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', expect.objectContaining({
        numVendaFk: 12345,
        nomeUsuario: 'joao',
        proximaAcao: '2026-04-25',
      }));
      expect(notificationService.clearOverdueNotificationsForSale).toHaveBeenCalledWith({
        numVenda: 12345,
        username: 'joao',
      });
      expect(res.json).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });
});
