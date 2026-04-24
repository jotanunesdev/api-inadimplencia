const usuarioModel = require('../models/usuarioModel');
const responsavelModel = require('../models/responsavelModel');
const notificationService = require('./notificationService');
const responsavelAssignmentService = require('./responsavelAssignmentService');

jest.mock('../models/usuarioModel');
jest.mock('../models/responsavelModel');
jest.mock('./notificationService');

describe('responsavelAssignmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('assignResponsavel', () => {
    it('should create notification when responsável changes to new user', async () => {
      const mockAdmin = {
        USER_CODE: 'admin123',
        PERFIL: 'admin',
      };
      usuarioModel.findByUserCode.mockResolvedValue(mockAdmin);

      const mockResponsavelAnterior = {
        NOME_USUARIO_FK: 'joao',
      };
      responsavelModel.findByNumVenda.mockResolvedValue(mockResponsavelAnterior);

      const mockResponsavelAtualizado = {
        NOME_USUARIO_FK: 'maria',
        CLIENTE: 'Client A',
        CPF_CNPJ: '12345678900',
        EMPREENDIMENTO: 'Emp A',
        VALOR_INADIMPLENTE: 1000,
        SCORE: 92,
        DT_ATRIBUICAO: new Date('2025-10-01T10:00:00.000Z'),
      };
      responsavelModel.upsert.mockResolvedValue(mockResponsavelAtualizado);

      notificationService.createAssignmentNotification.mockResolvedValue({
        id: 'uuid-123',
      });

      const result = await responsavelAssignmentService.assignResponsavel({
        numVenda: 12345,
        nomeUsuarioDestino: 'maria',
        adminUserCode: 'admin123',
      });

      expect(notificationService.createAssignmentNotification).toHaveBeenCalledWith({
        numVenda: 12345,
        destinatario: 'maria',
        adminUserCode: 'admin123',
        saleSnapshot: expect.objectContaining({
          cliente: 'Client A',
          responsavel: 'maria',
          score: 92,
        }),
      });

      expect(notificationService.notifyUnassignmentForSale).toHaveBeenCalledWith({
        numVenda: 12345,
        previousUsername: 'joao',
      });

      expect(result.changed).toBe(true);
    });

    it('should NOT create notification when responsável does not change', async () => {
      const mockAdmin = {
        USER_CODE: 'admin123',
        PERFIL: 'admin',
      };
      usuarioModel.findByUserCode.mockResolvedValue(mockAdmin);

      const mockResponsavelAnterior = {
        NOME_USUARIO_FK: 'joao',
      };
      responsavelModel.findByNumVenda.mockResolvedValue(mockResponsavelAnterior);

      const mockResponsavelAtualizado = {
        NOME_USUARIO_FK: 'joao',
        CLIENTE: 'Client A',
        CPF_CNPJ: '12345678900',
        EMPREENDIMENTO: 'Emp A',
        VALOR_INADIMPLENTE: 1000,
        SCORE: 92,
        DT_ATRIBUICAO: new Date('2025-10-01T10:00:00.000Z'),
      };
      responsavelModel.upsert.mockResolvedValue(mockResponsavelAtualizado);

      await responsavelAssignmentService.assignResponsavel({
        numVenda: 12345,
        nomeUsuarioDestino: 'joao',
        adminUserCode: 'admin123',
      });

      expect(notificationService.createAssignmentNotification).not.toHaveBeenCalled();
      expect(notificationService.notifyUnassignmentForSale).not.toHaveBeenCalled();
    });

    it('should NOT create notification when deleting responsável (no new responsável)', async () => {
      const mockAdmin = {
        USER_CODE: 'admin123',
        PERFIL: 'admin',
      };
      usuarioModel.findByUserCode.mockResolvedValue(mockAdmin);

      const mockResponsavelAnterior = {
        NOME_USUARIO_FK: 'joao',
      };
      responsavelModel.findByNumVenda.mockResolvedValue(mockResponsavelAnterior);

      // Simulate deletion by returning null for NOME_USUARIO_FK
      const mockResponsavelAtualizado = {
        NOME_USUARIO_FK: null, // No new responsável
      };
      responsavelModel.upsert.mockResolvedValue(mockResponsavelAtualizado);

      await responsavelAssignmentService.assignResponsavel({
        numVenda: 12345,
        nomeUsuarioDestino: 'DELETE', // Pass valid string but upsert returns null
        adminUserCode: 'admin123',
      });

      expect(notificationService.createAssignmentNotification).not.toHaveBeenCalled();
    });

    it('should NOT create notification for admin or previous responsável', async () => {
      const mockAdmin = {
        USER_CODE: 'admin123',
        PERFIL: 'admin',
      };
      usuarioModel.findByUserCode.mockResolvedValue(mockAdmin);

      const mockResponsavelAnterior = {
        NOME_USUARIO_FK: 'joao',
      };
      responsavelModel.findByNumVenda.mockResolvedValue(mockResponsavelAnterior);

      const mockResponsavelAtualizado = {
        NOME_USUARIO_FK: 'maria',
        CLIENTE: 'Client A',
        CPF_CNPJ: '12345678900',
        EMPREENDIMENTO: 'Emp A',
        VALOR_INADIMPLENTE: 1000,
        SCORE: 92,
        DT_ATRIBUICAO: new Date('2025-10-01T10:00:00.000Z'),
      };
      responsavelModel.upsert.mockResolvedValue(mockResponsavelAtualizado);

      notificationService.createAssignmentNotification.mockResolvedValue({
        id: 'uuid-123',
      });

      await responsavelAssignmentService.assignResponsavel({
        numVenda: 12345,
        nomeUsuarioDestino: 'maria',
        adminUserCode: 'admin123',
      });

      // Should only be called once for the new responsável (maria)
      expect(notificationService.createAssignmentNotification).toHaveBeenCalledTimes(1);
      expect(notificationService.createAssignmentNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          destinatario: 'maria',
        })
      );
      expect(notificationService.notifyUnassignmentForSale).toHaveBeenCalledWith({
        numVenda: 12345,
        previousUsername: 'joao',
      });
    });

    it('should not fail assignment if notification creation fails', async () => {
      const mockAdmin = {
        USER_CODE: 'admin123',
        PERFIL: 'admin',
      };
      usuarioModel.findByUserCode.mockResolvedValue(mockAdmin);

      const mockResponsavelAnterior = {
        NOME_USUARIO_FK: 'joao',
      };
      responsavelModel.findByNumVenda.mockResolvedValue(mockResponsavelAnterior);

      const mockResponsavelAtualizado = {
        NOME_USUARIO_FK: 'maria',
        CLIENTE: 'Client A',
        CPF_CNPJ: '12345678900',
        EMPREENDIMENTO: 'Emp A',
        VALOR_INADIMPLENTE: 1000,
        SCORE: 92,
        DT_ATRIBUICAO: new Date('2025-10-01T10:00:00.000Z'),
      };
      responsavelModel.upsert.mockResolvedValue(mockResponsavelAtualizado);

      notificationService.createAssignmentNotification.mockRejectedValue(
        new Error('Notification service error')
      );

      const result = await responsavelAssignmentService.assignResponsavel({
        numVenda: 12345,
        nomeUsuarioDestino: 'maria',
        adminUserCode: 'admin123',
      });

      // Assignment should still succeed
      expect(result.data).toEqual(mockResponsavelAtualizado);
      expect(result.changed).toBe(true);
      expect(notificationService.notifyUnassignmentForSale).toHaveBeenCalledWith({
        numVenda: 12345,
        previousUsername: 'joao',
      });
    });

    it('should handle case where there is no previous responsável', async () => {
      const mockAdmin = {
        USER_CODE: 'admin123',
        PERFIL: 'admin',
      };
      usuarioModel.findByUserCode.mockResolvedValue(mockAdmin);

      responsavelModel.findByNumVenda.mockResolvedValue(null); // No previous

      const mockResponsavelAtualizado = {
        NOME_USUARIO_FK: 'maria',
        CLIENTE: 'Client A',
        CPF_CNPJ: '12345678900',
        EMPREENDIMENTO: 'Emp A',
        VALOR_INADIMPLENTE: 1000,
        DT_ATRIBUICAO: new Date('2025-10-01T10:00:00.000Z'),
      };
      responsavelModel.upsert.mockResolvedValue(mockResponsavelAtualizado);

      notificationService.createAssignmentNotification.mockResolvedValue({
        id: 'uuid-123',
      });

      const result = await responsavelAssignmentService.assignResponsavel({
        numVenda: 12345,
        nomeUsuarioDestino: 'maria',
        adminUserCode: 'admin123',
      });

      expect(notificationService.createAssignmentNotification).toHaveBeenCalled();
      expect(result.changed).toBe(true);
      expect(result.previousUsername).toBeNull();
    });
  });

  describe('removeResponsavel', () => {
    it('should delete responsável and notify the previous user about unassignment', async () => {
      responsavelModel.findByNumVenda.mockResolvedValue({
        NOME_USUARIO_FK: 'joao',
      });
      responsavelModel.remove.mockResolvedValue(true);
      notificationService.notifyUnassignmentForSale.mockResolvedValue([]);

      const result = await responsavelAssignmentService.removeResponsavel(12345);

      expect(responsavelModel.findByNumVenda).toHaveBeenCalledWith(12345);
      expect(responsavelModel.remove).toHaveBeenCalledWith(12345);
      expect(notificationService.notifyUnassignmentForSale).toHaveBeenCalledWith({
        numVenda: 12345,
        previousUsername: 'joao',
      });
      expect(result).toEqual({
        deleted: true,
        previousUsername: 'joao',
      });
    });

    it('should throw 404 when responsável is not found', async () => {
      responsavelModel.findByNumVenda.mockResolvedValue(null);
      responsavelModel.remove.mockResolvedValue(false);

      await expect(responsavelAssignmentService.removeResponsavel(12345)).rejects.toThrow(
        'Responsavel nao encontrado.'
      );
      expect(notificationService.notifyUnassignmentForSale).not.toHaveBeenCalled();
    });

    it('should not fail removal if notification update fails', async () => {
      responsavelModel.findByNumVenda.mockResolvedValue({
        NOME_USUARIO_FK: 'joao',
      });
      responsavelModel.remove.mockResolvedValue(true);
      notificationService.notifyUnassignmentForSale.mockRejectedValue(new Error('SSE error'));

      const result = await responsavelAssignmentService.removeResponsavel(12345);

      expect(result).toEqual({
        deleted: true,
        previousUsername: 'joao',
      });
    });
  });
});
