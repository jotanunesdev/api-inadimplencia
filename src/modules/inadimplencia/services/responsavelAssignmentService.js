const usuarioModel = require('../models/usuarioModel');
const responsavelModel = require('../models/responsavelModel');
const notificationService = require('./notificationService');

function normalizeString(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function buildError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function assignResponsavel(params) {
  const numVenda = params.numVenda;
  const nomeUsuarioDestino = normalizeString(params.nomeUsuarioDestino);
  const adminUserCode = normalizeString(params.adminUserCode);

  if (!Number.isSafeInteger(numVenda)) {
    throw buildError('NUM_VENDA invalido.', 400);
  }

  if (!nomeUsuarioDestino) {
    throw buildError('NOME_USUARIO_DESTINO invalido.', 400);
  }

  if (!adminUserCode) {
    throw buildError('USER_CODE do admin e obrigatorio.', 400);
  }

  const admin = await usuarioModel.findByUserCode(adminUserCode);

  if (!admin) {
    throw buildError('Usuario administrador nao encontrado.', 404);
  }

  if (String(admin.PERFIL || '').trim().toLowerCase() !== 'admin') {
    throw buildError('Usuario sem permissao para atribuir vendas.', 403);
  }

  const responsavelAnterior = await responsavelModel.findByNumVenda(numVenda);
  const nomeResponsavelAnterior = responsavelAnterior?.NOME_USUARIO_FK
    ? String(responsavelAnterior.NOME_USUARIO_FK).trim()
    : null;

  const responsavelAtualizado = await responsavelModel.upsert(
    numVenda,
    nomeUsuarioDestino
  );

  if (!responsavelAtualizado) {
    throw buildError('Nao foi possivel atualizar o responsavel.', 500);
  }

  const nomeResponsavelAtual = responsavelAtualizado?.NOME_USUARIO_FK
    ? String(responsavelAtualizado.NOME_USUARIO_FK).trim()
    : null;

  const changed =
    String(nomeResponsavelAnterior || '').toLowerCase() !==
    String(nomeResponsavelAtual || '').toLowerCase();

  if (changed && nomeResponsavelAtual) {
    // Create notification for the new responsável only
    // Admin and previous responsável do not receive notification
    try {
      const saleSnapshot = {
        cliente: responsavelAtualizado.CLIENTE || 'N/A',
        cpfCnpj: responsavelAtualizado.CPF_CNPJ || null,
        empreendimento: responsavelAtualizado.EMPREENDIMENTO || null,
        valorInadimplente: responsavelAtualizado.VALOR_INADIMPLENTE || 0,
        score: responsavelAtualizado.SCORE ?? null,
        responsavel: nomeResponsavelAtual,
        dtAtribuicao: responsavelAtualizado.DT_ATRIBUICAO || new Date(),
      };

      await notificationService.createAssignmentNotification({
        numVenda,
        destinatario: nomeResponsavelAtual,
        adminUserCode: adminUserCode,
        saleSnapshot,
      });
    } catch (error) {
      // Log error but don't fail the assignment
      console.error('[responsavelAssignmentService] failed to create notification', {
        numVenda,
        destinatario: nomeResponsavelAtual,
        error: error.message,
      });
    }

    if (nomeResponsavelAnterior) {
      try {
        await notificationService.notifyUnassignmentForSale({
          numVenda,
          previousUsername: nomeResponsavelAnterior,
        });
      } catch (error) {
        console.error('[responsavelAssignmentService] failed to remove previous notification', {
          numVenda,
          previousUsername: nomeResponsavelAnterior,
          error: error.message,
        });
      }
    }
  }

  return {
    data: responsavelAtualizado,
    changed,
    previousUsername: nomeResponsavelAnterior,
    currentUsername: nomeResponsavelAtual,
    admin,
  };
}

async function removeResponsavel(numVenda) {
  if (!Number.isSafeInteger(numVenda)) {
    throw buildError('NUM_VENDA invalido.', 400);
  }

  const responsavelAnterior = await responsavelModel.findByNumVenda(numVenda);
  const previousUsername = responsavelAnterior?.NOME_USUARIO_FK
    ? String(responsavelAnterior.NOME_USUARIO_FK).trim()
    : null;

  const deleted = await responsavelModel.remove(numVenda);

  if (!deleted) {
    throw buildError('Responsavel nao encontrado.', 404);
  }

  if (previousUsername) {
    try {
      await notificationService.notifyUnassignmentForSale({
        numVenda,
        previousUsername,
      });
    } catch (error) {
      console.error('[responsavelAssignmentService] failed to notify unassignment', {
        numVenda,
        previousUsername,
        error: error.message,
      });
    }
  }

  return {
    deleted: true,
    previousUsername,
  };
}

module.exports = {
  assignResponsavel,
  removeResponsavel,
};
