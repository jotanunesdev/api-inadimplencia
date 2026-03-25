"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listChannels = listChannels;
exports.getChannelById = getChannelById;
exports.createChannel = createChannel;
exports.updateChannel = updateChannel;
exports.deleteChannel = deleteChannel;
const db_1 = require("../config/db");
async function listChannels() {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request().query("SELECT * FROM dbo.TCANAIS ORDER BY NOME");
    return result.recordset;
}
async function getChannelById(id) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query("SELECT * FROM dbo.TCANAIS WHERE ID = @ID");
    return result.recordset[0];
}
async function createChannel(input) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, input.id)
        .input("NOME", db_1.sql.NVarChar(255), input.nome)
        .input("CRIADO_POR", db_1.sql.NVarChar(255), input.criadoPor ?? null)
        .input("PATH", db_1.sql.NVarChar(500), input.path ?? null)
        .query("INSERT INTO dbo.TCANAIS (ID, NOME, CRIADO_POR, PATH) VALUES (@ID, @NOME, @CRIADO_POR, @PATH)");
    return getChannelById(input.id);
}
async function updateChannel(id, input) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .input("NOME", db_1.sql.NVarChar(255), input.nome ?? null)
        .input("CRIADO_POR", db_1.sql.NVarChar(255), input.criadoPor ?? null)
        .input("PATH", db_1.sql.NVarChar(500), input.path ?? null)
        .query("UPDATE dbo.TCANAIS SET NOME = COALESCE(@NOME, NOME), CRIADO_POR = COALESCE(@CRIADO_POR, CRIADO_POR), PATH = COALESCE(@PATH, PATH) WHERE ID = @ID");
    return getChannelById(id);
}
async function deleteChannel(id) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query("DELETE FROM dbo.TCANAIS WHERE ID = @ID");
}
