"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateInstructors = exports.listInstructorUsers = exports.listCompanySections = exports.listCompanyEmployeeObras = exports.listCompanyEmployees = exports.listAllUsers = exports.listCourses = exports.getByCpf = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const userMapping_1 = require("../utils/userMapping");
const normalizeCpf_1 = require("../utils/normalizeCpf");
const sectorAccess_1 = require("../utils/sectorAccess");
const readViewService_1 = require("../services/readViewService");
const userModel_1 = require("../models/userModel");
const userCourseModel_1 = require("../models/userCourseModel");
const COMPANY_EMPLOYEES_CACHE_TTL_MS = 5 * 60 * 1000;
const COMPANY_SECTIONS_CACHE_TTL_MS = 5 * 60 * 1000;
let companyEmployeesCache = null;
let companyEmployeesPromise = null;
let companySectionsCache = null;
let companySectionsPromise = null;
exports.getByCpf = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = await (0, userModel_1.getUserByCpf)(req.params.cpf);
    if (!user) {
        throw new httpError_1.HttpError(404, "Usuario nao encontrado");
    }
    const { HASH_SENHA: _hashSenha, READVIEW_JSON: _readView, ...safe } = user;
    res.json({ user: safe });
});
exports.listCourses = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const courses = await (0, userCourseModel_1.listUserCourses)(req.params.cpf);
    res.json({ courses });
});
const parseBoolean = (value) => {
    if (value === undefined)
        return undefined;
    if (value === "1" || value.toLowerCase() === "true")
        return true;
    if (value === "0" || value.toLowerCase() === "false")
        return false;
    return undefined;
};
const normalizeCode = (value) => (value ?? "").replace(/\s+/g, "").trim();
const normalizeCodeCompact = (value) => normalizeCode(value).replace(/[^0-9A-Za-z]/g, "");
const normalizeText = (value) => (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
const normalizeTextCompact = (value) => normalizeText(value).replace(/[^0-9a-z]/g, "");
const tokenizeSearch = (value) => normalizeText(value)
    .split(/[^0-9a-z]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
const escapeSectorPattern = (value) => String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const matchesSectorAlias = (normalizedValue, alias) => {
    const normalizedAlias = normalizeText(alias);
    if (!normalizedValue || !normalizedAlias) {
        return false;
    }
    if (normalizedValue === normalizedAlias) {
        return true;
    }
    if (normalizedAlias.includes(" ")) {
        return normalizedValue.includes(normalizedAlias);
    }
    return new RegExp(`(^|[^a-z0-9])${escapeSectorPattern(normalizedAlias)}([^a-z0-9]|$)`).test(normalizedValue);
};
const SECTOR_DEFINITIONS = [
    {
        aliases: ["ti", "tecnologia da informacao", "tecnologia da informação", "tecnologia"],
        key: "ti",
    },
    {
        aliases: [
            "sesmt",
            "seguranca do trabalho",
            "segurança do trabalho",
            "saude e seguranca",
            "saúde e segurança",
        ],
        key: "sesmt",
    },
    {
        aliases: ["qualidade", "gestao da qualidade", "gestão da qualidade", "qualidade e processos", "processos e qualidade"],
        key: "qualidade",
    },
    {
        aliases: [
            "recursos humanos",
            "rh",
            "gente e gestao",
            "gente e gestão",
            "departamento pessoal",
            "administracao de pessoal",
            "administração de pessoal",
            "adm pessoal",
            "adm. pessoal",
            "dp",
        ],
        key: "recursos-humanos",
    },
    {
        aliases: ["financeiro", "setor financeiro", "departamento financeiro"],
        key: "financeiro",
    },
    {
        aliases: ["contabilidade", "contabil", "setor contabil", "setor contabilidade"],
        key: "contabilidade",
    },
    {
        aliases: ["inovacao", "inovação"],
        key: "inovacao",
    },
    {
        aliases: ["diretoria", "diretoria executiva"],
        key: "diretoria",
    },
];
const resolveSectorKey = (value) => {
    const normalizedValue = normalizeText(value);
    if (!normalizedValue) {
        return "";
    }
    return (SECTOR_DEFINITIONS.find((item) => item.key === normalizedValue ||
        item.aliases.some((alias) => matchesSectorAlias(normalizedValue, alias)))?.key ?? "");
};
const filterEmployeesBySectorKey = (employees, sectorKey) => {
    const normalizedSectorKey = resolveSectorKey(sectorKey);
    if (!normalizedSectorKey) {
        return employees;
    }
    return employees.filter((employee) => {
        const locationEmployee = employee;
        const candidates = [
            employee.NOMEDEPARTAMENTO,
            locationEmployee.SECAO_DESCRICAO,
            locationEmployee.SETOR_OBRA,
            employee.raw?.NOMEDEPARTAMENTO,
            employee.raw?.NOME_SECAO,
            employee.raw?.DESCRICAOSECAO,
            employee.raw?.SECAO_DESCRICAO,
            employee.raw?.SETOR_OBRA,
            employee.raw?.SETOR,
        ];
        return candidates.some((value) => (0, sectorAccess_1.matchesSectorKey)(value, normalizedSectorKey));
    });
};
const matchesEmployeeSearch = (employee, search) => {
    const tokens = tokenizeSearch(search);
    if (tokens.length === 0) {
        return true;
    }
    const locationEmployee = employee;
    const searchableCompact = normalizeTextCompact([
        employee.CPF,
        employee.NOME,
        employee.NOME_FUNCAO,
        employee.NOMEDEPARTAMENTO,
        locationEmployee.SECAO_DESCRICAO,
        locationEmployee.OBRA_NOME,
        locationEmployee.SETOR_OBRA,
        employee.raw?.CPF,
        employee.raw?.NOME,
        employee.raw?.NOME_FUNCAO,
        employee.raw?.NOMEDEPARTAMENTO,
        employee.raw?.NOME_SECAO,
        employee.raw?.DESCRICAOSECAO,
        employee.raw?.SECAO_DESCRICAO,
        employee.raw?.SETOR_OBRA,
        employee.raw?.SETOR,
        employee.raw?.EMAIL,
        employee.raw?.EMAILCORPORATIVO,
        employee.raw?.EMAIL_CORPORATIVO,
        employee.raw?.MAIL,
        employee.raw?.LOGIN,
        employee.raw?.LOGINUSUARIO,
        employee.raw?.NOMEUSUARIOREDE,
        employee.raw?.USUARIOREDE,
        employee.raw?.USERNAME,
        employee.raw?.USERPRINCIPALNAME,
        employee.raw?.CODUSUARIO,
        employee.raw?.CODUSUARIOREDE,
    ]
        .filter(Boolean)
        .join(" "));
    return tokens.every((token) => searchableCompact.includes(normalizeTextCompact(token)));
};
const filterInstructorRecordsBySectorKey = (instructors, sectorKey, sectorCpfSet = null) => {
    const normalizedSectorKey = resolveSectorKey(sectorKey);
    if (!normalizedSectorKey) {
        return instructors;
    }
    return instructors.filter((instructor) => {
        const cpf = (0, normalizeCpf_1.normalizeCpf)(instructor.CPF ?? "");
        if (cpf && sectorCpfSet?.has(cpf)) {
            return true;
        }
        return (0, sectorAccess_1.matchesSectorKey)(instructor.SETOR, normalizedSectorKey);
    });
};
const commonPrefixLength = (left, right) => {
    const limit = Math.min(left.length, right.length);
    let index = 0;
    while (index < limit && left[index] === right[index]) {
        index += 1;
    }
    return index;
};
const splitCodeSegments = (value) => normalizeCode(value)
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
const isObraHierarchyCode = (value) => {
    const segments = splitCodeSegments(value);
    return segments[0] === "01" && segments[1] === "02";
};
const buildParentHierarchyCodes = (value) => {
    const segments = splitCodeSegments(value);
    const result = [];
    for (let index = segments.length - 1; index > 0; index -= 1) {
        result.push(segments.slice(0, index).join("."));
    }
    return result;
};
const splitObraAndSetor = (value) => {
    const text = (value ?? "").trim();
    if (!text) {
        return {
            obra: null,
            setor: null,
            left: null,
            right: null,
        };
    }
    const separatorIndex = text.indexOf(" - ");
    if (separatorIndex <= 0) {
        return { obra: text, setor: null, left: text, right: null };
    }
    const left = text.slice(0, separatorIndex).trim() || text;
    const right = text.slice(separatorIndex + 3).trim() || null;
    return { obra: left, setor: right, left, right };
};
const firstNonEmptyValue = (...values) => {
    for (const value of values) {
        const normalized = String(value ?? "").trim();
        if (normalized) {
            return normalized;
        }
    }
    return null;
};
const buildSectionAddress = (section) => {
    if (!section)
        return null;
    const street = firstNonEmptyValue(section.ENDERECO, section.ENDEREÇO, section.LOGRADOURO, section.RUA);
    const number = firstNonEmptyValue(section.NUMERO, section.NNUMERO, section.NUM);
    const complement = firstNonEmptyValue(section.COMPLEMENTO, section.COMPL, section.COMPLEMENTOENDERECO);
    const district = firstNonEmptyValue(section.BAIRRO);
    const cep = firstNonEmptyValue(section.CEP);
    const addressParts = [
        [street, number].filter(Boolean).join(", "),
        complement,
        district,
        cep ? `CEP ${cep}` : null,
    ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);
    return addressParts.length ? addressParts.join(" | ") : null;
};
const toStringRecord = (value) => {
    if (!value || typeof value !== "object")
        return null;
    const source = value;
    const record = {};
    for (const [key, raw] of Object.entries(source)) {
        if (raw === null || raw === undefined)
            continue;
        if (typeof raw === "object")
            continue;
        const text = String(raw).trim();
        if (!text)
            continue;
        record[key] = text;
    }
    return Object.keys(record).length > 0 ? record : null;
};
const collectSectionCandidates = (node, output) => {
    if (!node)
        return;
    if (Array.isArray(node)) {
        for (const item of node)
            collectSectionCandidates(item, output);
        return;
    }
    if (typeof node !== "object")
        return;
    const record = toStringRecord(node);
    if (record) {
        const hasCode = Boolean(record.CODIGO);
        const hasSectionData = Boolean(record.DESCRICAO) || Boolean(record.CIDADE) || Boolean(record.ESTADO);
        if (hasCode && hasSectionData) {
            output.push(record);
        }
    }
    for (const value of Object.values(node)) {
        collectSectionCandidates(value, output);
    }
};
const normalizeSectionRows = (payload) => {
    const candidates = [];
    collectSectionCandidates(payload, candidates);
    const unique = new Map();
    for (const section of candidates) {
        const col = normalizeCode(section.CODCOLIGADA);
        const cod = normalizeCode(section.CODIGO);
        if (!col || !cod)
            continue;
        unique.set(`${col}|${cod}`, section);
    }
    return Array.from(unique.values());
};
const deriveObraInfo = (params) => {
    const { section, codColigadaCompact, sectionByHierarchyKey } = params;
    const sectionCode = normalizeCode(section?.CODIGO);
    const sectionDescription = section?.DESCRICAO?.trim() ?? null;
    if (!sectionCode || !isObraHierarchyCode(sectionCode)) {
        return {
            OBRA_CODIGO: null,
            OBRA_NOME: null,
            SETOR_OBRA: null,
        };
    }
    if (!sectionDescription) {
        return {
            OBRA_CODIGO: sectionCode,
            OBRA_NOME: null,
            SETOR_OBRA: null,
        };
    }
    const parsed = splitObraAndSetor(sectionDescription);
    if (!parsed.setor) {
        return {
            OBRA_CODIGO: sectionCode,
            OBRA_NOME: parsed.obra,
            SETOR_OBRA: null,
        };
    }
    const parentCodes = buildParentHierarchyCodes(sectionCode);
    const parentSections = parentCodes
        .map((code) => sectionByHierarchyKey.get(`${codColigadaCompact}|${code}`) ?? null)
        .filter(Boolean);
    const normalizedLeft = normalizeText(parsed.left);
    const normalizedRight = normalizeText(parsed.right);
    const exactRightParent = parentSections.find((candidate) => normalizeText(candidate.DESCRICAO) === normalizedRight) ?? null;
    if (exactRightParent) {
        return {
            OBRA_CODIGO: normalizeCode(exactRightParent.CODIGO) || null,
            OBRA_NOME: exactRightParent.DESCRICAO?.trim() || parsed.right,
            SETOR_OBRA: parsed.left,
        };
    }
    const exactLeftParent = parentSections.find((candidate) => normalizeText(candidate.DESCRICAO) === normalizedLeft) ?? null;
    if (exactLeftParent) {
        return {
            OBRA_CODIGO: normalizeCode(exactLeftParent.CODIGO) || null,
            OBRA_NOME: exactLeftParent.DESCRICAO?.trim() || parsed.obra,
            SETOR_OBRA: parsed.setor,
        };
    }
    const fuzzyRightParent = parentSections.find((candidate) => {
        const normalized = normalizeText(candidate.DESCRICAO);
        if (!normalized || !normalizedRight)
            return false;
        return normalized === normalizedRight || normalizedRight.startsWith(normalized);
    }) ?? null;
    if (fuzzyRightParent) {
        return {
            OBRA_CODIGO: normalizeCode(fuzzyRightParent.CODIGO) || null,
            OBRA_NOME: fuzzyRightParent.DESCRICAO?.trim() || parsed.right,
            SETOR_OBRA: parsed.left,
        };
    }
    const targetObraNameNormalized = normalizeText(parsed.obra);
    const fuzzyParent = parentSections.find((candidate) => {
        const normalized = normalizeText(candidate.DESCRICAO);
        if (!normalized)
            return false;
        return (normalized === targetObraNameNormalized ||
            targetObraNameNormalized.startsWith(normalized) ||
            normalized.startsWith(targetObraNameNormalized));
    }) ?? null;
    return {
        OBRA_CODIGO: normalizeCode(fuzzyParent?.CODIGO) || null,
        OBRA_NOME: fuzzyParent?.DESCRICAO?.trim() || parsed.obra,
        SETOR_OBRA: parsed.setor,
    };
};
function buildCompanyEmployeesWithLocation(employees, sections) {
    const sectionByKey = new Map();
    const sectionByHierarchyKey = new Map();
    const sectionByDescription = new Map();
    const sectionByDescriptionCompact = new Map();
    const sectionsByColigada = new Map();
    for (const section of sections) {
        const codColigada = normalizeCode(section.CODCOLIGADA);
        const codigo = normalizeCode(section.CODIGO);
        const codColigadaCompact = normalizeCodeCompact(section.CODCOLIGADA);
        const codigoCompact = normalizeCodeCompact(section.CODIGO);
        if (codColigada && codigo)
            sectionByKey.set(`${codColigada}|${codigo}`, section);
        if (codColigadaCompact && codigoCompact) {
            sectionByKey.set(`${codColigadaCompact}|${codigoCompact}`, section);
        }
        if (codColigadaCompact && codigo) {
            sectionByHierarchyKey.set(`${codColigadaCompact}|${codigo}`, section);
        }
        const descricao = normalizeText(section.DESCRICAO);
        if (descricao)
            sectionByDescription.set(descricao, section);
        const descricaoCompact = normalizeTextCompact(section.DESCRICAO);
        if (descricaoCompact)
            sectionByDescriptionCompact.set(descricaoCompact, section);
        const list = sectionsByColigada.get(codColigadaCompact) ?? [];
        list.push(section);
        sectionsByColigada.set(codColigadaCompact, list);
    }
    return employees.map((employee) => {
        const raw = employee.raw ?? {};
        const codColigada = normalizeCode(raw.CODCOLIGADA);
        const codSecao = normalizeCode(raw.CODSECAO);
        const codColigadaCompact = normalizeCodeCompact(raw.CODCOLIGADA);
        const codSecaoCompact = normalizeCodeCompact(raw.CODSECAO);
        let section = sectionByKey.get(`${codColigada}|${codSecao}`) ??
            sectionByKey.get(`${codColigadaCompact}|${codSecaoCompact}`) ??
            null;
        if (!section && codColigadaCompact && codSecaoCompact) {
            const candidates = sectionsByColigada.get(codColigadaCompact) ?? [];
            let bestMatch = null;
            let bestScore = 0;
            for (const candidate of candidates) {
                const candidateCode = normalizeCodeCompact(candidate.CODIGO);
                if (!candidateCode)
                    continue;
                const exact = candidateCode === codSecaoCompact;
                const prefixLen = commonPrefixLength(candidateCode, codSecaoCompact);
                const isPrefixRelation = candidateCode.startsWith(codSecaoCompact) || codSecaoCompact.startsWith(candidateCode);
                if (!exact && !isPrefixRelation)
                    continue;
                const score = exact ? Number.MAX_SAFE_INTEGER : prefixLen;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = candidate;
                }
            }
            section = bestMatch;
        }
        if (!section) {
            const descricaoFuncionario = normalizeText(raw.DESCRICAOSECAO ?? raw.NOME_SECAO ?? raw.NOMEDEPARTAMENTO);
            if (descricaoFuncionario) {
                section = sectionByDescription.get(descricaoFuncionario) ?? null;
            }
        }
        if (!section) {
            const descricaoFuncionarioCompact = normalizeTextCompact(raw.DESCRICAOSECAO ?? raw.NOME_SECAO ?? raw.NOMEDEPARTAMENTO);
            if (descricaoFuncionarioCompact) {
                section = sectionByDescriptionCompact.get(descricaoFuncionarioCompact) ?? null;
            }
        }
        const obraInfo = deriveObraInfo({ section, codColigadaCompact, sectionByHierarchyKey });
        return {
            ...employee,
            SECAO_DESCRICAO: section?.DESCRICAO ?? raw.DESCRICAOSECAO ?? raw.NOME_SECAO ?? employee.NOMEDEPARTAMENTO ?? null,
            SECAO_CIDADE: section?.CIDADE ?? raw.CIDADESECAO ?? raw.CIDADE_SECAO ?? raw.CIDADE ?? null,
            SECAO_ESTADO: section?.ESTADO ??
                raw.ESTADOSECAO ??
                raw.ESTADO_SECAO ??
                raw.UFSECAO ??
                raw.ESTADO ??
                raw.UF ??
                null,
            ...obraInfo,
        };
    });
}
exports.listAllUsers = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { cpf, nome, ativo, instrutor } = req.query;
    const users = await (0, userModel_1.listUsers)({
        cpf: cpf?.trim() || undefined,
        nome: nome?.trim() || undefined,
        ativo: parseBoolean(ativo),
        instrutor: parseBoolean(instrutor),
    });
    res.json({ users });
});
function mapCompanyEmployees(rows) {
    const candidates = rows
        .map((row) => {
        const isActive = (row.CODSITUACAO ?? "").trim().toUpperCase() === "A";
        if (!isActive) {
            return null;
        }
        const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(row.CPF ?? "");
        if (cpfDigits.length !== 11) {
            return null;
        }
        return {
            CPF: cpfDigits,
            NOME: row.NOME ?? null,
            NOME_FUNCAO: row.NOME_FUNCAO ?? row.CARGO ?? null,
            NOMEDEPARTAMENTO: row.NOMEDEPARTAMENTO ?? row.NOME_SECAO ?? null,
            raw: row,
        };
    });
    const byCpf = new Map();
    for (const item of candidates) {
        if (!item)
            continue;
        const current = byCpf.get(item.CPF);
        if (!current) {
            byCpf.set(item.CPF, item);
            continue;
        }
        const currentActive = (current.raw.CODSITUACAO ?? "").toUpperCase() === "A";
        const incomingActive = (item.raw.CODSITUACAO ?? "").toUpperCase() === "A";
        if (!currentActive && incomingActive) {
            byCpf.set(item.CPF, item);
            continue;
        }
        const currentUpdated = current.raw.RECMODIFIEDON ?? "";
        const incomingUpdated = item.raw.RECMODIFIEDON ?? "";
        if (incomingUpdated > currentUpdated) {
            byCpf.set(item.CPF, item);
        }
    }
    return Array.from(byCpf.values()).sort((a, b) => (a.NOME ?? "").localeCompare(b.NOME ?? "", "pt-BR"));
}
async function loadCompanyEmployeesFresh() {
    const readViewResult = await (0, readViewService_1.readView)({
        dataServerName: "FopFuncData",
        filter: "PFUNC.CODCOLIGADA=1 AND PFUNC.CODSITUACAO='A'",
        context: "CODCOLIGADA=1",
    });
    const rows = (0, readViewService_1.extractPFuncRows)(readViewResult);
    return mapCompanyEmployees(rows);
}
function escapeReadViewFilterValue(value) {
    return value.replace(/'/g, "''");
}
function chunkArray(items, size) {
    const result = [];
    for (let index = 0; index < items.length; index += size) {
        result.push(items.slice(index, index + size));
    }
    return result;
}
async function loadCompanyEmployeesByObraCodes(obraCodes) {
    const normalizedCodes = Array.from(new Set(obraCodes.map((code) => normalizeCode(code)).filter(Boolean)));
    if (normalizedCodes.length === 0) {
        return [];
    }
    const codeChunks = chunkArray(normalizedCodes, 20);
    const allRows = [];
    for (const chunk of codeChunks) {
        const conditions = chunk
            .map((code) => `PFUNC.CODSECAO LIKE '${escapeReadViewFilterValue(code)}%'`)
            .join(" OR ");
        const filter = `PFUNC.CODCOLIGADA=1 AND PFUNC.CODSITUACAO='A' AND (${conditions})`;
        // eslint-disable-next-line no-await-in-loop
        const readViewResult = await (0, readViewService_1.readView)({
            dataServerName: "FopFuncData",
            filter,
            context: "CODCOLIGADA=1",
        });
        const rows = (0, readViewService_1.extractPFuncRows)(readViewResult);
        allRows.push(...rows);
    }
    return mapCompanyEmployees(allRows);
}
function getObraCodesForFilter(sections, params) {
    const sectionByHierarchyKey = new Map();
    for (const section of sections) {
        const codColigadaCompact = normalizeCodeCompact(section.CODCOLIGADA);
        const codigo = normalizeCode(section.CODIGO);
        if (!codColigadaCompact || !codigo)
            continue;
        sectionByHierarchyKey.set(`${codColigadaCompact}|${codigo}`, section);
    }
    const targetObraCodigo = params.obraCodigo ? normalizeCode(params.obraCodigo) : "";
    const targetObraNome = params.obra ? normalizeText(params.obra) : "";
    const codes = new Set();
    for (const section of sections) {
        const codColigadaCompact = normalizeCodeCompact(section.CODCOLIGADA);
        const obraInfo = deriveObraInfo({
            section,
            codColigadaCompact,
            sectionByHierarchyKey,
        });
        const matchesByCode = Boolean(targetObraCodigo) && normalizeCode(obraInfo.OBRA_CODIGO) === targetObraCodigo;
        const matchesByName = !targetObraCodigo &&
            Boolean(targetObraNome) &&
            normalizeText(obraInfo.OBRA_NOME) === targetObraNome;
        if (!matchesByCode && !matchesByName)
            continue;
        const obraCode = normalizeCode(obraInfo.OBRA_CODIGO);
        if (obraCode)
            codes.add(obraCode);
    }
    return Array.from(codes);
}
async function getCompanyEmployees(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh &&
        companyEmployeesCache &&
        companyEmployeesCache.expiresAt > now) {
        return companyEmployeesCache.data;
    }
    if (!companyEmployeesPromise) {
        companyEmployeesPromise = loadCompanyEmployeesFresh()
            .then((employees) => {
            companyEmployeesCache = {
                data: employees,
                expiresAt: Date.now() + COMPANY_EMPLOYEES_CACHE_TTL_MS,
            };
            return employees;
        })
            .finally(() => {
            companyEmployeesPromise = null;
        });
    }
    try {
        return await companyEmployeesPromise;
    }
    catch (error) {
        if (companyEmployeesCache?.data.length) {
            return companyEmployeesCache.data;
        }
        throw error;
    }
}
exports.listCompanyEmployees = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const forceRefresh = parseBoolean(req.query.refresh?.trim()) === true;
    const obraFilterRaw = req.query.obra?.trim();
    const obraCodigoFilterRaw = req.query.obraCodigo?.trim();
    const includeLocation = parseBoolean(req.query.includeLocation?.trim()) === true;
    const sectorKeyFilterRaw = req.query.sectorKey?.trim();
    const cpfFilter = (0, normalizeCpf_1.normalizeCpf)(String(req.query.cpf ?? ""));
    const nomeFilter = normalizeText(String(req.query.nome ?? ""));
    const searchFilter = String(req.query.search ?? "").trim();
    const sections = await getCompanySectionsNormalized(forceRefresh);
    let employees;
    if (obraCodigoFilterRaw || obraFilterRaw) {
        const obraCodes = getObraCodesForFilter(sections, {
            obra: obraFilterRaw,
            obraCodigo: obraCodigoFilterRaw,
        });
        employees = await loadCompanyEmployeesByObraCodes(obraCodes);
    }
    else {
        employees = await getCompanyEmployees(forceRefresh);
    }
    let enrichedEmployees = buildCompanyEmployeesWithLocation(employees, sections);
    if (obraCodigoFilterRaw) {
        const obraCodigoFilter = normalizeCode(obraCodigoFilterRaw);
        enrichedEmployees = enrichedEmployees.filter((item) => normalizeCode(item.OBRA_CODIGO) === obraCodigoFilter);
    }
    else if (obraFilterRaw) {
        const obraFilter = normalizeText(obraFilterRaw);
        enrichedEmployees = enrichedEmployees.filter((item) => normalizeText(item.OBRA_NOME) === obraFilter);
    }
    if (cpfFilter) {
        enrichedEmployees = enrichedEmployees.filter((item) => (0, normalizeCpf_1.normalizeCpf)(item.CPF) === cpfFilter);
    }
    if (nomeFilter) {
        enrichedEmployees = enrichedEmployees.filter((item) => normalizeText(item.NOME).includes(nomeFilter));
    }
    if (searchFilter) {
        enrichedEmployees = enrichedEmployees.filter((item) => matchesEmployeeSearch(item, searchFilter));
    }
    if (sectorKeyFilterRaw) {
        enrichedEmployees = filterEmployeesBySectorKey(enrichedEmployees, sectorKeyFilterRaw);
    }
    if (!includeLocation) {
        res.json({
            employees: enrichedEmployees.map((item) => ({
                CPF: item.CPF,
                NOME: item.NOME,
                NOME_FUNCAO: item.NOME_FUNCAO,
                NOMEDEPARTAMENTO: item.NOMEDEPARTAMENTO,
                raw: item.raw,
            })),
        });
        return;
    }
    res.json({ employees: enrichedEmployees });
});
exports.listCompanyEmployeeObras = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const forceRefresh = parseBoolean(req.query.refresh?.trim()) === true;
    const sections = await getCompanySectionsNormalized(forceRefresh);
    const sectionByHierarchyKey = new Map();
    for (const section of sections) {
        const codColigadaCompact = normalizeCodeCompact(section.CODCOLIGADA);
        const codigo = normalizeCode(section.CODIGO);
        if (!codColigadaCompact || !codigo)
            continue;
        sectionByHierarchyKey.set(`${codColigadaCompact}|${codigo}`, section);
    }
    const byKey = new Map();
    for (const section of sections) {
        const sectionCode = normalizeCode(section.CODIGO);
        if (!isObraHierarchyCode(sectionCode))
            continue;
        const codColigadaCompact = normalizeCodeCompact(section.CODCOLIGADA);
        const obraInfo = deriveObraInfo({
            section,
            codColigadaCompact,
            sectionByHierarchyKey,
        });
        const nome = obraInfo.OBRA_NOME?.trim();
        if (!nome)
            continue;
        const codigo = obraInfo.OBRA_CODIGO ? normalizeCode(obraInfo.OBRA_CODIGO) : null;
        const key = codigo ? `codigo:${codigo}` : `nome:${normalizeText(nome)}`;
        if (!key)
            continue;
        if (!byKey.has(key)) {
            byKey.set(key, {
                codigo,
                nome,
                cidade: firstNonEmptyValue(section.CIDADE, section.CIDADESECAO, section.CIDADE_SECAO),
                estado: firstNonEmptyValue(section.ESTADO, section.UF, section.ESTADOSECAO, section.ESTADO_SECAO, section.UFSECAO),
                endereco: buildSectionAddress(section),
            });
        }
    }
    const obras = Array.from(byKey.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    res.json({ obras });
});
async function readCompanySections() {
    const attempts = [
        {
            dataServerName: "FopSecaoDataBR",
            filter: "1=1",
            context: "CODCOLIGADA=1",
        },
        {
            dataServerName: "FopSecaoDataBR",
            context: "CODCOLIGADA=1",
        },
        {
            dataServerName: "FopSecaoDataBR",
        },
    ];
    let lastError;
    for (const attempt of attempts) {
        try {
            // eslint-disable-next-line no-await-in-loop
            return await (0, readViewService_1.readView)(attempt);
        }
        catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}
async function loadCompanySectionsFresh() {
    const sectionsPayload = await readCompanySections();
    return normalizeSectionRows(sectionsPayload);
}
async function getCompanySectionsNormalized(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh &&
        companySectionsCache &&
        companySectionsCache.expiresAt > now) {
        return companySectionsCache.data;
    }
    if (!companySectionsPromise) {
        companySectionsPromise = loadCompanySectionsFresh()
            .then((sections) => {
            companySectionsCache = {
                data: sections,
                expiresAt: Date.now() + COMPANY_SECTIONS_CACHE_TTL_MS,
            };
            return sections;
        })
            .finally(() => {
            companySectionsPromise = null;
        });
    }
    try {
        return await companySectionsPromise;
    }
    catch (error) {
        if (companySectionsCache?.data.length) {
            return companySectionsCache.data;
        }
        throw error;
    }
}
exports.listCompanySections = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const sections = await readCompanySections();
    res.json({ sections });
});
async function getSectorEmployeeCpfSet(sectorKey) {
    const normalizedSectorKey = resolveSectorKey(sectorKey);
    if (!normalizedSectorKey) {
        return new Set();
    }
    const employees = await getCompanyEmployees();
    const sectorEmployees = filterEmployeesBySectorKey(employees, normalizedSectorKey);
    return new Set(sectorEmployees
        .map((item) => (0, normalizeCpf_1.normalizeCpf)(item.CPF))
        .filter((value) => value.length === 11));
}
exports.listInstructorUsers = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const sectorKey = String(req.query.sectorKey ?? "").trim();
    const instructors = await (0, userModel_1.listInstructors)();
    if (!sectorKey) {
        res.json({ instructors });
        return;
    }
    const sectorCpfSet = await getSectorEmployeeCpfSet(sectorKey);
    res.json({
        instructors: filterInstructorRecordsBySectorKey(instructors, sectorKey, sectorCpfSet),
    });
});
exports.updateInstructors = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { users } = req.body;
    const sectorKey = String(req.body?.sectorKey ?? req.query.sectorKey ?? "").trim();
    if (!Array.isArray(users)) {
        throw new httpError_1.HttpError(400, "Lista de usuarios e obrigatoria");
    }
    const sectorCpfSet = sectorKey ? await getSectorEmployeeCpfSet(sectorKey) : null;
    const selectedCpfs = [];
    for (const item of users) {
        const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(item.cpf ?? "");
        if (cpfDigits.length !== 11) {
            continue;
        }
        if (sectorCpfSet && !sectorCpfSet.has(cpfDigits)) {
            continue;
        }
        const rawRecord = {};
        const rawUser = item.user;
        if (rawUser && typeof rawUser === "object") {
            for (const [key, rawValue] of Object.entries(rawUser)) {
                if (rawValue === null || rawValue === undefined)
                    continue;
                const str = String(rawValue).trim();
                if (!str)
                    continue;
                rawRecord[key] = str;
            }
        }
        rawRecord.CPF = cpfDigits;
        const mapped = (0, userMapping_1.mapReadViewToUser)(rawRecord);
        // eslint-disable-next-line no-await-in-loop
        await (0, userModel_1.upsertUser)({ ...mapped, instrutor: true });
        selectedCpfs.push(cpfDigits);
    }
    if (sectorCpfSet) {
        const uniqueSelectedCpfs = Array.from(new Set(selectedCpfs));
        const cpfsToDisable = Array.from(sectorCpfSet).filter((cpf) => !uniqueSelectedCpfs.includes(cpf));
        await (0, userModel_1.setInstructorFlags)(cpfsToDisable, false);
        await (0, userModel_1.setInstructorFlags)(uniqueSelectedCpfs, true);
        const instructors = await (0, userModel_1.listInstructors)();
        res.json({
            instructors: filterInstructorRecordsBySectorKey(instructors, sectorKey, sectorCpfSet),
            scope: resolveSectorKey(sectorKey),
            updated: uniqueSelectedCpfs.length,
        });
        return;
    }
    await (0, userModel_1.clearAllInstructors)();
    for (const cpf of selectedCpfs) {
        // eslint-disable-next-line no-await-in-loop
        await (0, userModel_1.setInstructorFlag)(cpf, true);
    }
    const instructors = await (0, userModel_1.listInstructors)();
    res.json({ updated: instructors.length, instructors });
});
