"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listNotificationUsernamesBySectorKey = listNotificationUsernamesBySectorKey;
exports.buildTrainingNotificationAuthor = buildTrainingNotificationAuthor;
exports.normalizeTrainingNotificationSectorKey = normalizeTrainingNotificationSectorKey;
const db_1 = require("../config/db");
const readViewService_1 = require("./readViewService");
const sectorAccess_1 = require("../utils/sectorAccess");
const COMPANY_EMPLOYEES_CACHE_TTL_MS = 5 * 60 * 1000;
const USERNAME_CANDIDATE_KEYS = [
    "MAIL",
    "EMAIL",
    "EMAILCORPORATIVO",
    "EMAIL_CORPORATIVO",
    "USERPRINCIPALNAME",
    "LOGINUSUARIO",
    "LOGIN",
    "NOMEUSUARIOREDE",
    "USUARIOREDE",
    "USERNAME",
    "CODUSUARIOREDE",
    "CODUSUARIO",
];
let companyEmployeesCache = null;
let companyEmployeesPromise = null;
function extractUsernameFromRecord(record) {
    if (!record) {
        return "";
    }
    for (const key of USERNAME_CANDIDATE_KEYS) {
        const username = (0, sectorAccess_1.normalizeUsernameValue)(record[key]);
        if (username && !username.includes(" ")) {
            return username;
        }
    }
    return "";
}
function resolveSectorCandidates(record) {
    if (!record) {
        return [];
    }
    return [
        record.SETOR,
        record.NOMEDEPARTAMENTO,
        record.NOME_SECAO,
        record.DESCRICAOSECAO,
        record.SECAO_DESCRICAO,
        record.SETOR_OBRA,
    ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);
}
function recordBelongsToSector(record, sectorKey) {
    const normalizedSectorKey = (0, sectorAccess_1.resolveSectorKey)(sectorKey);
    if (!normalizedSectorKey || !record) {
        return false;
    }
    return resolveSectorCandidates(record).some((candidate) => (0, sectorAccess_1.matchesSectorKey)(candidate, normalizedSectorKey));
}
async function listStoredUsernamesBySectorKey(sectorKey) {
    const normalizedSectorKey = (0, sectorAccess_1.resolveSectorKey)(sectorKey);
    if (!normalizedSectorKey) {
        return [];
    }
    const pool = await (0, db_1.getPool)();
    const result = await pool.request().query(`
    SELECT
      CPF,
      NOME,
      SETOR,
      READVIEW_JSON,
      ATIVO,
      JSON_VALUE(READVIEW_JSON, '$.MAIL') AS MAIL,
      JSON_VALUE(READVIEW_JSON, '$.EMAIL') AS EMAIL,
      JSON_VALUE(READVIEW_JSON, '$.EMAILCORPORATIVO') AS EMAILCORPORATIVO,
      JSON_VALUE(READVIEW_JSON, '$.EMAIL_CORPORATIVO') AS EMAIL_CORPORATIVO,
      JSON_VALUE(READVIEW_JSON, '$.USERPRINCIPALNAME') AS USERPRINCIPALNAME,
      JSON_VALUE(READVIEW_JSON, '$.LOGINUSUARIO') AS LOGINUSUARIO,
      JSON_VALUE(READVIEW_JSON, '$.LOGIN') AS LOGIN,
      JSON_VALUE(READVIEW_JSON, '$.NOMEUSUARIOREDE') AS NOMEUSUARIOREDE,
      JSON_VALUE(READVIEW_JSON, '$.USUARIOREDE') AS USUARIOREDE,
      JSON_VALUE(READVIEW_JSON, '$.USERNAME') AS USERNAME,
      JSON_VALUE(READVIEW_JSON, '$.CODUSUARIOREDE') AS CODUSUARIOREDE,
      JSON_VALUE(READVIEW_JSON, '$.CODUSUARIO') AS CODUSUARIO,
      JSON_VALUE(READVIEW_JSON, '$.NOMEDEPARTAMENTO') AS NOMEDEPARTAMENTO,
      JSON_VALUE(READVIEW_JSON, '$.NOME_SECAO') AS NOME_SECAO,
      JSON_VALUE(READVIEW_JSON, '$.DESCRICAOSECAO') AS DESCRICAOSECAO,
      JSON_VALUE(READVIEW_JSON, '$.SECAO_DESCRICAO') AS SECAO_DESCRICAO,
      JSON_VALUE(READVIEW_JSON, '$.SETOR_OBRA') AS SETOR_OBRA
    FROM dbo.TUSUARIOS
    WHERE ATIVO = 1 OR ATIVO IS NULL
  `);
    const usernames = new Set();
    for (const row of result.recordset) {
        const record = Object.fromEntries(Object.entries(row)
            .filter(([, value]) => value !== null && value !== undefined)
            .map(([key, value]) => [key, String(value).trim()]));
        if (!recordBelongsToSector(record, normalizedSectorKey)) {
            continue;
        }
        const username = extractUsernameFromRecord(record);
        if (username) {
            usernames.add(username);
        }
    }
    return Array.from(usernames);
}
async function loadCompanyEmployeesFresh() {
    const readViewResult = await (0, readViewService_1.readView)({
        dataServerName: "FopFuncData",
        filter: "PFUNC.CODCOLIGADA=1 AND PFUNC.CODSITUACAO='A'",
        context: "CODCOLIGADA=1",
    });
    return (0, readViewService_1.extractPFuncRows)(readViewResult);
}
async function loadCompanyEmployees() {
    const now = Date.now();
    if (companyEmployeesCache && companyEmployeesCache.expiresAt > now) {
        return companyEmployeesCache.data;
    }
    if (!companyEmployeesPromise) {
        companyEmployeesPromise = loadCompanyEmployeesFresh()
            .then((data) => {
            companyEmployeesCache = {
                data,
                expiresAt: Date.now() + COMPANY_EMPLOYEES_CACHE_TTL_MS,
            };
            return data;
        })
            .finally(() => {
            companyEmployeesPromise = null;
        });
    }
    return companyEmployeesPromise;
}
async function listCompanyUsernamesBySectorKey(sectorKey) {
    const normalizedSectorKey = (0, sectorAccess_1.resolveSectorKey)(sectorKey);
    if (!normalizedSectorKey) {
        return [];
    }
    const employees = await loadCompanyEmployees();
    const usernames = new Set();
    for (const employee of employees) {
        if (!recordBelongsToSector(employee, normalizedSectorKey)) {
            continue;
        }
        const username = extractUsernameFromRecord(employee);
        if (username) {
            usernames.add(username);
        }
    }
    return Array.from(usernames);
}
async function listNotificationUsernamesBySectorKey(sectorKey) {
    const normalizedSectorKey = (0, sectorAccess_1.resolveSectorKey)(sectorKey);
    if (!normalizedSectorKey) {
        return [];
    }
    const [storedUsernames, companyUsernames] = await Promise.all([
        listStoredUsernamesBySectorKey(normalizedSectorKey).catch(() => []),
        listCompanyUsernamesBySectorKey(normalizedSectorKey).catch(() => []),
    ]);
    return Array.from(new Set([...storedUsernames, ...companyUsernames]
        .map((value) => (0, sectorAccess_1.normalizeUsernameValue)(value))
        .filter((value) => value && !value.includes(" ")))).sort((left, right) => left.localeCompare(right, "pt-BR"));
}
function buildTrainingNotificationAuthor(input) {
    const authorUsername = (0, sectorAccess_1.normalizeUsernameValue)(input.authorUsername);
    const authorName = String(input.authorName ?? "").trim() ||
        String(input.authorUsername ?? "").trim() ||
        null;
    return {
        authorName,
        authorUsername,
    };
}
function normalizeTrainingNotificationSectorKey(value) {
    return (0, sectorAccess_1.resolveSectorKey)((0, sectorAccess_1.normalizeSectorText)(value));
}
