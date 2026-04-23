const model = require('../models/responsavelModel');
const { assignResponsavel, removeResponsavel } = require('../services/responsavelAssignmentService');
const controller = require('../controllers/responsavelController');

jest.mock('../models/responsavelModel');
jest.mock('../services/responsavelAssignmentService');

describe('responsavelController', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
    next = jest.fn();
  });

  describe('update', () => {
    it('should return 400 if numVenda is invalid', async () => {
      req.params.numVenda = 'abc';
      req.body.nomeUsuario = 'maria';

      await controller.update(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'NUM_VENDA invalido.' });
      expect(assignResponsavel).not.toHaveBeenCalled();
    });

    it('should call assignResponsavel with parsed data', async () => {
      req.params.numVenda = '12345';
      req.body.nomeUsuario = ' Maria ';
      req.body.adminUserCode = 'admin123';

      assignResponsavel.mockResolvedValue({ data: { numVenda: 12345 } });

      await controller.update(req, res, next);

      expect(assignResponsavel).toHaveBeenCalledWith({
        numVenda: 12345,
        nomeUsuarioDestino: 'Maria',
        adminUserCode: 'admin123',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ data: { numVenda: 12345 } });
    });

    it('should forward errors', async () => {
      req.params.numVenda = '12345';
      req.body.nomeUsuario = 'maria';
      assignResponsavel.mockRejectedValue(new Error('Service error'));

      await controller.update(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('remove', () => {
    it('should return 400 if numVenda is invalid', async () => {
      req.params.numVenda = 'abc';

      await controller.remove(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'NUM_VENDA invalido.' });
      expect(removeResponsavel).not.toHaveBeenCalled();
    });

    it('should call removeResponsavel and return 204', async () => {
      req.params.numVenda = '12345';
      removeResponsavel.mockResolvedValue({ deleted: true, previousUsername: 'joao' });

      await controller.remove(req, res, next);

      expect(removeResponsavel).toHaveBeenCalledWith(12345);
      expect(res.status).not.toHaveBeenCalledWith(400);
      expect(res.status).not.toHaveBeenCalledWith(404);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('should forward errors', async () => {
      req.params.numVenda = '12345';
      removeResponsavel.mockRejectedValue(new Error('Service error'));

      await controller.remove(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getAll', () => {
    it('should return all responsáveis', async () => {
      model.findAll.mockResolvedValue([{ NUM_VENDA_FK: 12345 }]);

      await controller.getAll(req, res, next);

      expect(model.findAll).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ data: [{ NUM_VENDA_FK: 12345 }] });
    });
  });
});
