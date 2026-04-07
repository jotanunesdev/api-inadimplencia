const atendimentosModel = require('../models/atendimentosModel');
const inadimplenciaModel = require('../models/inadimplenciaModel');
const ocorrenciasModel = require('../models/ocorrenciasModel');
const responsavelModel = require('../models/responsavelModel');
const kanbanStatusModel = require('../models/kanbanStatusModel');

function parseNumVenda(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const num = Number(value);
  if (!Number.isSafeInteger(num)) {
    return null;
  }
  return num;
}

async function create(req, res, next) {
  try {
    
    const numVendaRaw = req.body.numVenda ?? req.body.NUM_VENDA ?? req.body.NUM_VENDA_FK;
    const numVenda = parseNumVenda(numVendaRaw);
    if (numVenda === null) {
      return res.status(400).json({ error: 'NUM_VENDA_FK e obrigatorio.' });
    }
    
    const active = await kanbanStatusModel.findActiveByNumVenda(numVenda);

    if (active) {
      const expired = await kanbanStatusModel.moveTimedOutToTodo(numVenda);

      if (expired) {
        const atendimentosAnteriores = await atendimentosModel.findByNumVenda(numVenda);
        const latest = atendimentosAnteriores[0] || null;

        if (latest?.PROTOCOLO) {
          await atendimentosModel.updateStatusProtocolo(latest.PROTOCOLO, false);
        }
      } else {
        return res.status(409).json({
          error: active.NOME_USUARIO_FK
            ? `Já existe atendimento em andamento por ${active.NOME_USUARIO_FK}.`
            : 'Já existe atendimento em andamento para esta venda.'
        });
      }
    }


    const vendaRecords = await inadimplenciaModel.findByNumVenda(String(numVenda));
    if (!vendaRecords || vendaRecords.length === 0) {
      return res.status(404).json({ error: 'Venda nao encontrada.' });
    }
    
    const vendaSnapshot = vendaRecords[0];
    const responsavel = await responsavelModel.findByNumVenda(numVenda);
    const vendaSnapshotWithResponsavel = {
      ...vendaSnapshot,
      RESPONSAVEL: responsavel?.NOME_USUARIO_FK ?? null,
      NOME_USUARIO_FK: responsavel?.NOME_USUARIO_FK ?? null,
      COR_HEX: responsavel?.COR_HEX ?? null,
      RESPONSAVEL_COR_HEX: responsavel?.COR_HEX ?? null,
    };

    let atendimento;
    try {
      atendimento = await atendimentosModel.createFromVenda(numVenda, vendaSnapshotWithResponsavel);
    } catch (err) {
      const isActiveAttendanceError = 
        err?.code === 'ATENDIMENTO_ATIVO';

      if (isActiveAttendanceError) {
        const activeKanban = await kanbanStatusModel.findActiveByNumVenda(numVenda);
        const nomeResponsavel = activeKanban?.NOME_USUARIO_FK ??
          err?.activeAttendance?.RESPONSAVEL ??
          err?.activeAttendance?.NOME_USUARIO_FK ??
          null;

          return res.status(409).json({
            error: nomeResponsavel
              ? `Já existe atendimento em andamento por ${nomeResponsavel}.`
              : 'Já existe atendimento em andamento para esta venda.'
          });
      }

      throw err;
    }
    
    res.status(201).json({ data: atendimento });
  } catch (err) {
    next(err);
  }
}

async function getByProtocolo(req, res, next) {
  try {
    const { protocolo } = req.params;
    if (!protocolo || typeof protocolo !== 'string' || !protocolo.trim()) {
      return res.status(400).json({ error: 'PROTOCOLO invalido.' });
    }

    const atendimento = await atendimentosModel.findByProtocolo(protocolo.trim());
    if (!atendimento) {
      return res.status(404).json({ error: 'Atendimento nao encontrado.' });
    }

    const ocorrencias = await ocorrenciasModel.findByProtocolo(protocolo.trim());
    res.json({
      data: {
        atendimento,
        venda: atendimento.VENDA_SNAPSHOT ?? null,
        ocorrencias,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getByCpf(req, res, next) {
  try {
    const { cpf } = req.params;
    if (!cpf || typeof cpf !== 'string' || !cpf.trim()) {
      return res.status(400).json({ error: 'CPF/CNPJ invalido.' });
    }

    const data = await atendimentosModel.findByCpf(cpf.trim());
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getByNumVenda(req, res, next) {
  try {
    const numVenda = parseNumVenda(req.params.numVenda);
    if (numVenda === null) {
      return res.status(400).json({ error: 'NUM_VENDA invalido.' });
    }

    const data = await atendimentosModel.findByNumVenda(numVenda);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getByNomeCliente(req, res, next) {
  try {
    const { nomeCliente } = req.params;

    if (!nomeCliente || typeof nomeCliente !== 'string') {
      return res.status(400).json({ error: 'Nome do cliente invalido.'});
    }

    const data = await atendimentosModel.findbyNomeCliente(nomeCliente);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

// async function createExpirationAtendimento(req, res, next) {
//   try {
//     const { protocolo } = req.params;
//     const { nomeUsuario } = req.body;

//     const atendimento = await atendimento.findByProtocolo;
//     if (!atendimento) return res.status(404).json({ error: 'Protocolo não encontrado. '});

//     const statusProtocolo = false;
//     await atendimentosModel.updateStatusOcorrencia(protocolo, statusProtocolo)
    
//     res.json({ data });
//   } catch (err) {
//     next(err);
//   }
// }



module.exports = {
  create,
  getByProtocolo,
  getByCpf,
  getByNumVenda,
  getByNomeCliente
};
