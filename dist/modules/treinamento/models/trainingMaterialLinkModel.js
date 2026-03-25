"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTrainingMaterialLinksByStoredPaths = listTrainingMaterialLinksByStoredPaths;
const db_1 = require("../config/db");
async function listTrainingMaterialLinksByStoredPaths(paths) {
    const normalizedPaths = Array.from(new Set((Array.isArray(paths) ? paths : [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)));
    if (normalizedPaths.length === 0) {
        return [];
    }
    const pool = await (0, db_1.getPool)();
    const request = pool.request();
    const pathPlaceholders = normalizedPaths.map((value, index) => {
        const inputName = `PATH_${index}`;
        request.input(inputName, db_1.sql.NVarChar(2000), value);
        return `@${inputName}`;
    });
    const inClause = pathPlaceholders.join(", ");
    const result = await request.query(`
    ;WITH V_LATEST AS (
      SELECT
        v.ID AS MATERIAL_ID,
        v.TRILHA_FK_ID AS TRILHA_ID,
        v.PATH_VIDEO AS STORED_PATH,
        ROW_NUMBER() OVER (PARTITION BY v.ID ORDER BY v.VERSAO DESC) AS RN
      FROM dbo.TVIDEOS v
      WHERE v.PATH_VIDEO IN (${inClause})
    ),
    P_LATEST AS (
      SELECT
        p.ID AS MATERIAL_ID,
        p.TRILHA_FK_ID AS TRILHA_ID,
        p.PDF_PATH AS STORED_PATH,
        ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
      FROM dbo.TPDFS p
      WHERE p.PDF_PATH IN (${inClause})
    )
    SELECT
      CAST('video' AS VARCHAR(20)) AS TIPO,
      v.MATERIAL_ID,
      v.TRILHA_ID,
      t.TITULO AS TRILHA_TITULO,
      m.ID AS MODULO_ID,
      m.NOME AS MODULO_NOME,
      v.STORED_PATH
    FROM V_LATEST v
    LEFT JOIN dbo.TTRILHAS t ON t.ID = v.TRILHA_ID
    LEFT JOIN dbo.TMODULOS m ON m.ID = t.MODULO_FK_ID
    WHERE v.RN = 1

    UNION ALL

    SELECT
      CAST('pdf' AS VARCHAR(20)) AS TIPO,
      p.MATERIAL_ID,
      p.TRILHA_ID,
      t.TITULO AS TRILHA_TITULO,
      m.ID AS MODULO_ID,
      m.NOME AS MODULO_NOME,
      p.STORED_PATH
    FROM P_LATEST p
    LEFT JOIN dbo.TTRILHAS t ON t.ID = p.TRILHA_ID
    LEFT JOIN dbo.TMODULOS m ON m.ID = t.MODULO_FK_ID
    WHERE p.RN = 1
    ORDER BY MODULO_NOME, TRILHA_TITULO, TIPO, MATERIAL_ID
  `);
    return result.recordset;
}
