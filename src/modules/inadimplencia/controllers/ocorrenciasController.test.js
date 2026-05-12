const model = require('../models/ocorrenciasModel');
const responsavelModel = require('../models/responsavelModel');
const notificationService = require('../services/notificationService');
const controller = require('./ocorrenciasController');

jest.mock('../models/ocorrenciasModel');
jest.mock('../models/responsavelModel');
jest.mock('../services/notificationService');

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatLocalDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function daysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

describe('ocorrenciasController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should clear overdue notifications when the new proximaAcao is current or future', async () => {
      const today = daysFromToday(0);
      const futureDate = daysFromToday(7);
      model.validateNumVendaFk.mockResolvedValue({ exists: true });
      model.create.mockResolvedValue({
        ID: 'uuid-1',
        NUM_VENDA_FK: 12345,
        NOME_USUARIO_FK: 'joao',
        PROXIMA_ACAO: new Date(`${futureDate}T10:00:00.000Z`),
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
          dtOcorrencia: today,
          horaOcorrencia: '10:00:00',
          proximaAcao: futureDate,
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
        proximaAcao: futureDate,
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
      const today = daysFromToday(0);
      const futureDate = daysFromToday(7);
      model.validateNumVendaFk.mockResolvedValue({ exists: true });
      model.update.mockResolvedValue({
        ID: 'uuid-2',
        NUM_VENDA_FK: 12345,
        NOME_USUARIO_FK: 'joao',
        PROXIMA_ACAO: new Date(`${futureDate}T10:00:00.000Z`),
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
          dtOcorrencia: today,
          horaOcorrencia: '10:00:00',
          proximaAcao: futureDate,
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
        proximaAcao: futureDate,
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
