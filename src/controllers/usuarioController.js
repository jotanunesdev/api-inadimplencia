const model = require('../models/usuarioModel');

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6})$/;
const PERFIL_VALUES = new Set(['admin', 'operador']);

function normalizeHex(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return HEX_COLOR_REGEX.test(withHash) ? withHash : null;
}

function normalizePerfil(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return PERFIL_VALUES.has(normalized) ? normalized : null;
}

async function getAll(req, res, next) {
  try {
    const rawUserCode = req.query.userCode ?? req.query.user_code;
    if (rawUserCode) {
      const userCode = String(rawUserCode).trim();
      if (!userCode) {
        return res.status(400).json({ error: 'USER_CODE e obrigatorio.' });
      }

      const data = await model.findByUserCode(userCode);
      if (!data) {
        return res.status(404).json({ error: 'Usuario nao encontrado.' });
      }

      return res.json({ data });
    }

    const data = await model.findAll();
    return res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getByNome(req, res, next) {
  try {
    const { nome } = req.params;
    if (!nome || typeof nome !== 'string') {
      return res.status(400).json({ error: 'NOME e obrigatorio.' });
    }

    const data = await model.findByNome(nome.trim());
    if (!data) {
      return res.status(404).json({ error: 'Usuario nao encontrado.' });
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const nome = req.body.nome ?? req.body.NOME;
    const userCode = req.body.userCode ?? req.body.USER_CODE ?? null;
    const perfilRaw = req.body.perfil ?? req.body.PERFIL ?? null;
    const cpfUsuario = req.body.cpfUsuario ?? req.body.CPF_USUARIO ?? null;
    const setor = req.body.setor ?? req.body.SETOR ?? null;
    const cargo = req.body.cargo ?? req.body.CARGO ?? null;
    const ativo = req.body.ativo ?? req.body.ATIVO ?? 1;
    const corHexRaw = req.body.corHex ?? req.body.COR_HEX ?? null;

    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      return res.status(400).json({ error: 'NOME e obrigatorio.' });
    }

    const normalizedName = nome.trim();
    const normalizedUserCode =
      typeof userCode === 'string' && userCode.trim() ? userCode.trim() : null;
    const normalizedPerfil = normalizePerfil(perfilRaw);
    if (perfilRaw && !normalizedPerfil) {
      return res.status(400).json({ error: 'PERFIL invalido. Use admin ou operador.' });
    }

    const defaultPerfil =
      normalizedPerfil ?? (normalizedUserCode === 'wffluig' ? 'admin' : 'operador');

    if (normalizedUserCode) {
      const existingByCode = await model.findByUserCode(normalizedUserCode);
      if (existingByCode) {
        const shouldUpdate =
          normalizedName &&
          String(existingByCode.NOME || '').trim().toLowerCase() !==
            normalizedName.toLowerCase();
        if (shouldUpdate || normalizedPerfil) {
          const updated = await model.updateByUserCode(normalizedUserCode, {
            nome: normalizedName,
            perfil: normalizedPerfil ?? existingByCode.PERFIL ?? defaultPerfil,
          });
          return res.status(200).json({ data: updated ?? existingByCode, exists: true });
        }
        return res.status(200).json({ data: existingByCode, exists: true });
      }
    }

    const existing = await model.findByNome(normalizedName);
    if (existing) {
      if (normalizedUserCode || normalizedPerfil) {
        const updated = await model.update(normalizedName, {
          userCode: normalizedUserCode ?? existing.USER_CODE ?? null,
          perfil: normalizedPerfil ?? existing.PERFIL ?? defaultPerfil,
        });
        return res.status(200).json({ data: updated ?? existing, exists: true });
      }
      return res.status(200).json({ data: existing, exists: true });
    }

    const corHex = normalizeHex(corHexRaw);
    if (corHexRaw && !corHex) {
      return res.status(400).json({ error: 'COR_HEX invalida.' });
    }

    const data = await model.create({
      nome: normalizedName,
      userCode: normalizedUserCode,
      perfil: defaultPerfil,
      cpfUsuario: typeof cpfUsuario === 'string' ? cpfUsuario.trim() : null,
      setor: typeof setor === 'string' ? setor.trim() : null,
      cargo: typeof cargo === 'string' ? cargo.trim() : null,
      ativo: ativo === 0 || ativo === false ? 0 : 1,
      corHex,
    });

    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { nome } = req.params;
    if (!nome || typeof nome !== 'string') {
      return res.status(400).json({ error: 'NOME e obrigatorio.' });
    }

    const userCode = req.body.userCode ?? req.body.USER_CODE ?? null;
    const perfilRaw = req.body.perfil ?? req.body.PERFIL ?? null;
    const cpfUsuario = req.body.cpfUsuario ?? req.body.CPF_USUARIO ?? null;
    const setor = req.body.setor ?? req.body.SETOR ?? null;
    const cargo = req.body.cargo ?? req.body.CARGO ?? null;
    const ativo = req.body.ativo ?? req.body.ATIVO ?? null;
    const corHexRaw = req.body.corHex ?? req.body.COR_HEX ?? null;

    const perfil = normalizePerfil(perfilRaw);
    if (perfilRaw && !perfil) {
      return res.status(400).json({ error: 'PERFIL invalido. Use admin ou operador.' });
    }

    const corHex = normalizeHex(corHexRaw);
    if (corHexRaw && !corHex) {
      return res.status(400).json({ error: 'COR_HEX invalida.' });
    }

    const data = await model.update(nome.trim(), {
      userCode: typeof userCode === 'string' ? userCode.trim() : null,
      perfil,
      cpfUsuario: typeof cpfUsuario === 'string' ? cpfUsuario.trim() : null,
      setor: typeof setor === 'string' ? setor.trim() : null,
      cargo: typeof cargo === 'string' ? cargo.trim() : null,
      ativo: ativo === null ? null : ativo === 0 || ativo === false ? 0 : 1,
      corHex,
    });

    if (!data) {
      return res.status(404).json({ error: 'Usuario nao encontrado.' });
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { nome } = req.params;
    if (!nome || typeof nome !== 'string') {
      return res.status(400).json({ error: 'NOME e obrigatorio.' });
    }

    const deleted = await model.remove(nome.trim());
    if (!deleted) {
      return res.status(404).json({ error: 'Usuario nao encontrado.' });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  getByNome,
  create,
  update,
  remove,
};
