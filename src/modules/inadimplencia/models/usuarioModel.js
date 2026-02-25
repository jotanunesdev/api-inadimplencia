const { getPool, sql } = require('../config/db');

const TABLE = 'dbo.USUARIO';

async function findAll() {
  const pool = await getPool();
  const result = await pool.request().query(`SELECT * FROM ${TABLE}`);
  return result.recordset;
}

async function findByNome(nome) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('nome', sql.VarChar, nome)
    .query(`SELECT * FROM ${TABLE} WHERE NOME = @nome`);

  return result.recordset[0] || null;
}

async function findByUserCode(userCode) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userCode', sql.VarChar, userCode)
    .query(`SELECT * FROM ${TABLE} WHERE USER_CODE = @userCode`);

  return result.recordset[0] || null;
}

async function create(data) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('nome', sql.VarChar, data.nome)
    .input('userCode', sql.VarChar, data.userCode ?? null)
    .input('perfil', sql.VarChar, data.perfil ?? null)
    .input('cpfUsuario', sql.VarChar, data.cpfUsuario ?? null)
    .input('setor', sql.VarChar, data.setor ?? null)
    .input('cargo', sql.VarChar, data.cargo ?? null)
    .input('ativo', sql.Bit, data.ativo ?? 1)
    .input('corHex', sql.VarChar, data.corHex ?? null)
    .query(
      `INSERT INTO ${TABLE} (NOME, USER_CODE, PERFIL, CPF_USUARIO, SETOR, CARGO, ATIVO, COR_HEX)
       OUTPUT inserted.*
       VALUES (@nome, @userCode, @perfil, @cpfUsuario, @setor, @cargo, @ativo, @corHex)`
    );

  return result.recordset[0];
}

async function update(nome, data) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('nome', sql.VarChar, nome)
    .input('userCode', sql.VarChar, data.userCode ?? null)
    .input('perfil', sql.VarChar, data.perfil ?? null)
    .input('cpfUsuario', sql.VarChar, data.cpfUsuario ?? null)
    .input('setor', sql.VarChar, data.setor ?? null)
    .input('cargo', sql.VarChar, data.cargo ?? null)
    .input('ativo', sql.Bit, data.ativo ?? null)
    .input('corHex', sql.VarChar, data.corHex ?? null)
    .query(
      `UPDATE ${TABLE}
       SET CPF_USUARIO = COALESCE(@cpfUsuario, CPF_USUARIO),
           SETOR = COALESCE(@setor, SETOR),
           CARGO = COALESCE(@cargo, CARGO),
           ATIVO = COALESCE(@ativo, ATIVO),
           COR_HEX = COALESCE(@corHex, COR_HEX),
           USER_CODE = COALESCE(@userCode, USER_CODE),
           PERFIL = COALESCE(@perfil, PERFIL)
       WHERE NOME = @nome;
       SELECT * FROM ${TABLE} WHERE NOME = @nome;`
    );

  return result.recordset[0] || null;
}

async function updateByUserCode(userCode, data) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userCode', sql.VarChar, userCode)
    .input('nome', sql.VarChar, data.nome ?? null)
    .input('perfil', sql.VarChar, data.perfil ?? null)
    .input('cpfUsuario', sql.VarChar, data.cpfUsuario ?? null)
    .input('setor', sql.VarChar, data.setor ?? null)
    .input('cargo', sql.VarChar, data.cargo ?? null)
    .input('ativo', sql.Bit, data.ativo ?? null)
    .input('corHex', sql.VarChar, data.corHex ?? null)
    .query(
      `UPDATE ${TABLE}
       SET NOME = COALESCE(@nome, NOME),
           CPF_USUARIO = COALESCE(@cpfUsuario, CPF_USUARIO),
           SETOR = COALESCE(@setor, SETOR),
           CARGO = COALESCE(@cargo, CARGO),
           ATIVO = COALESCE(@ativo, ATIVO),
           COR_HEX = COALESCE(@corHex, COR_HEX),
           PERFIL = COALESCE(@perfil, PERFIL)
       WHERE USER_CODE = @userCode;
       SELECT * FROM ${TABLE} WHERE USER_CODE = @userCode;`
    );

  return result.recordset[0] || null;
}

async function remove(nome) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('nome', sql.VarChar, nome)
    .query(`DELETE FROM ${TABLE} WHERE NOME = @nome`);

  return result.rowsAffected[0] > 0;
}

module.exports = {
  findAll,
  findByNome,
  findByUserCode,
  create,
  update,
  updateByUserCode,
  remove,
};
