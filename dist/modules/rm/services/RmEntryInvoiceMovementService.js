"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RmEntryInvoiceMovementService = void 0;
const env_1 = require("../config/env");
const RmDataServerClient_1 = require("../clients/RmDataServerClient");
const RmService_1 = require("./RmService");
const Xml_1 = require("../utils/Xml");
function toCompactString(value) {
    if (value === null || value === undefined) {
        return null;
    }
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
}
function formatDecimal(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return null;
    }
    return Number(value).toFixed(4).replace('.', ',');
}
function formatDateTime(value) {
    if (!value) {
        return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date.toISOString().slice(0, 19);
}
function xmlTag(tag, value) {
    if (value === null || value === undefined || String(value).trim().length === 0) {
        return `<${tag}></${tag}>`;
    }
    return `<${tag}>${Xml_1.Xml.escape(String(value))}</${tag}>`;
}
function joinXml(nodes) {
    return nodes.filter(Boolean).join('');
}
function safePreview(value) {
    try {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        if (!serialized || serialized.trim().length === 0) {
            return '<vazio>';
        }
        return serialized.length > 500 ? `${serialized.slice(0, 500)}...` : serialized;
    }
    catch {
        return '<nao serializavel>';
    }
}
function normalizePrimaryKey(value) {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return null;
    }
    const semicolonCandidate = trimmed
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s*;\s*/g, ';');
    if (semicolonCandidate.includes(';')) {
        const parts = semicolonCandidate
            .split(';')
            .map((part) => part.trim())
            .filter(Boolean);
        if (parts.length >= 2) {
            return `${parts[0]};${parts[1]}`;
        }
    }
    const keyedCandidate = /CODCOLIGADA\s*=?\s*([A-Za-z0-9_-]+)[^\w]+IDMOV\s*=?\s*([A-Za-z0-9_-]+)/i.exec(trimmed) ??
        /IDMOV\s*=?\s*([A-Za-z0-9_-]+)[^\w]+CODCOLIGADA\s*=?\s*([A-Za-z0-9_-]+)/i.exec(trimmed);
    if (keyedCandidate) {
        const keyedText = keyedCandidate[0] ?? '';
        const firstValue = keyedCandidate[1]?.trim();
        const secondValue = keyedCandidate[2]?.trim();
        if (firstValue && secondValue) {
            return keyedText.toUpperCase().indexOf('CODCOLIGADA') < keyedText.toUpperCase().indexOf('IDMOV')
                ? `${firstValue};${secondValue}`
                : `${secondValue};${firstValue}`;
        }
    }
    const xmlCandidate = /<CODCOLIGADA>([^<]+)<\/CODCOLIGADA>[\s\S]*?<IDMOV>([^<]+)<\/IDMOV>/i.exec(trimmed) ??
        /<IDMOV>([^<]+)<\/IDMOV>[\s\S]*?<CODCOLIGADA>([^<]+)<\/CODCOLIGADA>/i.exec(trimmed);
    if (xmlCandidate) {
        const firstValue = xmlCandidate[1]?.trim();
        const secondValue = xmlCandidate[2]?.trim();
        if (firstValue && secondValue) {
            return trimmed.indexOf('<CODCOLIGADA>') <= trimmed.indexOf('<IDMOV>')
                ? `${firstValue};${secondValue}`
                : `${secondValue};${firstValue}`;
        }
    }
    return null;
}
function findValueByKey(value, fieldName) {
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findValueByKey(item, fieldName);
            if (found) {
                return found;
            }
        }
        return null;
    }
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    for (const [key, nestedValue] of Object.entries(value)) {
        if (key.toUpperCase() === fieldName.toUpperCase()) {
            const directValue = toCompactString(nestedValue);
            if (directValue) {
                return directValue;
            }
        }
        const nestedFound = findValueByKey(nestedValue, fieldName);
        if (nestedFound) {
            return nestedFound;
        }
    }
    return null;
}
function buildPrimaryKeyCandidate(value) {
    if (typeof value === 'string') {
        return normalizePrimaryKey(value);
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = buildPrimaryKeyCandidate(item);
            if (found) {
                return found;
            }
        }
        return null;
    }
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const codColigada = findValueByKey(value, 'CODCOLIGADA');
    const movementId = findValueByKey(value, 'IDMOV');
    if (codColigada && movementId) {
        return `${codColigada};${movementId}`;
    }
    for (const nestedValue of Object.values(value)) {
        const found = buildPrimaryKeyCandidate(nestedValue);
        if (found) {
            return found;
        }
    }
    return null;
}
function extractMovementId(value, primaryKey) {
    const keyParts = primaryKey
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean);
    if (keyParts.length >= 2) {
        return keyParts[keyParts.length - 1] ?? null;
    }
    return findValueByKey(value, 'IDMOV');
}
class RmEntryInvoiceMovementService {
    rmService = new RmService_1.RmService(new RmDataServerClient_1.RmDataServerClient({
        dbTrustCert: env_1.env.DB_TRUST_CERT,
        readViewUrl: env_1.env.READVIEW_URL,
        readViewUser: env_1.env.READVIEW_USER,
        readViewPassword: env_1.env.READVIEW_PASSWORD,
        readViewAction: env_1.env.READVIEW_ACTION,
        readViewNamespace: env_1.env.READVIEW_NAMESPACE,
        getSchemaAction: env_1.env.GETSCHEMA_ACTION,
        readRecordAction: env_1.env.READRECORD_ACTION,
        saveRecordAction: env_1.env.SAVERECORD_ACTION,
    }));
    async integrate(entry) {
        if (!env_1.env.isConfigured) {
            throw new Error((0, env_1.buildMissingConfigMessage)());
        }
        if (!entry.header.codColigada) {
            throw new Error('CODCOLIGADA obrigatorio para integrar a nota no RM.');
        }
        const xml = this.buildMovementXml(entry);
        const context = `CODCOLIGADA=${entry.header.codColigada};CODUSUARIO=${env_1.env.READVIEW_USER};CODSISTEMA=G`;
        const raw = await this.rmService.execute({
            operation: 'SaveRecord',
            dataserver: 'MOVMOVIMENTOTBCDATA',
            context,
            xml,
        });
        const primaryKey = buildPrimaryKeyCandidate(raw);
        if (!primaryKey) {
            throw new Error(`RM nao retornou a primary key do movimento integrado. Retorno: ${safePreview(raw)}`);
        }
        const movementId = extractMovementId(raw, primaryKey) ?? '';
        if (!movementId) {
            throw new Error(`RM nao retornou o IDMOV do movimento integrado. Retorno: ${safePreview(raw)}`);
        }
        return {
            primaryKey,
            movementId,
            raw,
        };
    }
    buildMovementXml(entry) {
        const movementIdPlaceholder = '-1';
        const generatedLink = `entrada-nota-fiscal/${entry.id}`;
        const movementXml = joinXml([
            '<TMOV>',
            xmlTag('CODCOLIGADA', entry.header.codColigada),
            xmlTag('IDMOV', movementIdPlaceholder),
            xmlTag('CODFILIAL', entry.header.codFilial),
            xmlTag('CODLOC', entry.header.codLoc),
            xmlTag('NUMEROMOV', entry.header.numeroMov),
            xmlTag('SEGUNDONUMERO', entry.id.slice(0, 8)),
            xmlTag('SERIE', entry.header.serie),
            xmlTag('CODTMV', entry.header.codTmv),
            xmlTag('CODCFO', entry.header.codCfo),
            xmlTag('CODCOLCFO', entry.header.codColCfo),
            xmlTag('CODCPG', entry.header.codCpg),
            xmlTag('DATAEMISSAO', formatDateTime(entry.header.dataEmissao)),
            xmlTag('DATASAIDA', formatDateTime(entry.header.dataSaida)),
            xmlTag('VALORBRUTO', formatDecimal(entry.header.valorBruto)),
            xmlTag('VALORLIQUIDO', formatDecimal(entry.header.valorLiquido)),
            xmlTag('VALOROUTROS', formatDecimal(entry.header.valorOutros)),
            xmlTag('VALORFRETE', formatDecimal(entry.header.valorFrete)),
            xmlTag('VALORDESC', formatDecimal(entry.header.valorDesc)),
            xmlTag('VALORDESP', formatDecimal(entry.header.valorDesp)),
            xmlTag('CHAVEACESSONFE', entry.header.chaveAcessoNfe),
            xmlTag('CODTDO', entry.header.codTdo),
            xmlTag('IDNAT', entry.header.idNat),
            xmlTag('CODNAT', entry.header.codNat),
            xmlTag('HISTORICOCURTO', entry.header.historico),
            xmlTag('HISTORICOLONGO', entry.header.observacaoAvaliacao),
            '</TMOV>',
        ]);
        const movementComplXml = joinXml([
            '<TMOVCOMPL>',
            xmlTag('CODCOLIGADA', entry.header.codColigada),
            xmlTag('IDMOV', movementIdPlaceholder),
            xmlTag('IDFLUIG', entry.id),
            xmlTag('LINKFLUIG', generatedLink),
            xmlTag('REQUISITANTE', entry.requestedBy ?? entry.createdBy),
            xmlTag('HISTCOMPL', entry.header.historico),
            xmlTag('OBSAVALIACAO', entry.header.observacaoAvaliacao),
            xmlTag('ATEND', entry.header.atendimento?.toString() ?? null),
            xmlTag('PRAZO', entry.header.prazo?.toString() ?? null),
            xmlTag('QUALIDADE', entry.header.qualidade?.toString() ?? null),
            '</TMOVCOMPL>',
        ]);
        const itemTotals = new Map(entry.items.map((item) => [
            item.seqF ?? item.nseqItmMov ?? String(item.lineNumber),
            Number(item.valorLiquido ?? 0),
        ]));
        const itemsXml = entry.items
            .map((item) => {
            const itemSequence = item.nseqItmMov ?? String(item.lineNumber);
            return joinXml([
                '<TITMMOV>',
                xmlTag('CODCOLIGADA', entry.header.codColigada),
                xmlTag('IDMOV', movementIdPlaceholder),
                xmlTag('IDMOVHST', '-1'),
                xmlTag('NSEQITMMOV', itemSequence),
                xmlTag('CODFILIAL', entry.header.codFilial),
                xmlTag('NUMEROSEQUENCIAL', itemSequence),
                xmlTag('IDPRD', item.idPrd),
                xmlTag('CODIGOPRD', item.codigoPrd),
                xmlTag('NUMNOFABRIC', item.numNoFabric),
                xmlTag('CODUND', item.codUnd),
                xmlTag('CODLOC', entry.header.codLoc),
                xmlTag('DATAEMISSAO', formatDateTime(entry.header.dataEmissao)),
                xmlTag('IDNAT', item.idNat),
                xmlTag('CODNAT', item.codNat),
                xmlTag('CODTBORCAMENTO', item.codTborcamento),
                xmlTag('CODCOLTBORCAMENTO', item.codColTborcamento),
                xmlTag('QUANTIDADE', formatDecimal(item.quantidade)),
                xmlTag('PRECOUNITARIO', formatDecimal(item.precoUnitario)),
                xmlTag('VALORBRUTOITEM', formatDecimal(item.valorBrutoItem)),
                xmlTag('HISTORICOCURTO', item.nomeFantasia),
                '</TITMMOV>',
            ]);
        })
            .join('');
        const itemsComplXml = entry.items
            .map((item) => {
            const itemSequence = item.nseqItmMov ?? String(item.lineNumber);
            return joinXml([
                '<TITMMOVCOMPL>',
                xmlTag('CODCOLIGADA', entry.header.codColigada),
                xmlTag('IDMOV', movementIdPlaceholder),
                xmlTag('NSEQITMMOV', itemSequence),
                xmlTag('IDMOVOC', item.idMovOc),
                xmlTag('NSEQITMMOVOC', item.nseqItmMovOc),
                '</TITMMOVCOMPL>',
            ]);
        })
            .join('');
        const apportionmentsXml = entry.apportionments
            .map((apportionment, index) => {
            const itemKey = apportionment.itemSeqF ?? apportionment.nseqItmMov ?? '';
            const itemValue = itemTotals.get(itemKey) ?? 0;
            const amount = Number(apportionment.valor ?? 0);
            const percentage = itemValue > 0 ? (amount / itemValue) * 100 : 0;
            return joinXml([
                '<TITMMOVRATCCU>',
                xmlTag('CODCOLIGADA', entry.header.codColigada),
                xmlTag('IDMOV', movementIdPlaceholder),
                xmlTag('IDMOVRATCCU', String(index + 1)),
                xmlTag('NSEQITMMOV', apportionment.nseqItmMov ?? apportionment.itemSeqF),
                xmlTag('CODCCUSTO', apportionment.codCcusto),
                xmlTag('NOME', apportionment.descCusto),
                xmlTag('VALOR', formatDecimal(apportionment.valor)),
                xmlTag('PERCENTUAL', formatDecimal(percentage)),
                '</TITMMOVRATCCU>',
            ]);
        })
            .join('');
        const taxesXml = entry.taxes
            .map((tax) => joinXml([
            '<TTRBITMMOV>',
            xmlTag('CODCOLIGADA', entry.header.codColigada),
            xmlTag('IDMOV', movementIdPlaceholder),
            xmlTag('NSEQITMMOV', tax.nseqItmMov ?? tax.itemSeqF),
            xmlTag('CODTRB', tax.codTrb),
            xmlTag('SITTRIBUTARIA', tax.sitTributaria),
            xmlTag('BASEDECALCULO', formatDecimal(tax.baseDeCalculo)),
            xmlTag('ALIQUOTA', formatDecimal(tax.aliquota)),
            xmlTag('VALOR', formatDecimal(tax.valor)),
            xmlTag('TIPORECOLHIMENTO', tax.tipoRecolhimento ?? '1'),
            xmlTag('EDITADO', '1'),
            '</TTRBITMMOV>',
        ]))
            .join('');
        const paymentsXml = entry.payments
            .map((payment, index) => joinXml([
            '<TMOVPAGTO>',
            xmlTag('CODCOLIGADA', payment.codColigada ?? entry.header.codColigada),
            xmlTag('IDMOV', movementIdPlaceholder),
            xmlTag('IDSEQPAGTO', payment.idSeqPagto ?? String(index + 1)),
            xmlTag('DATAVENCIMENTO', formatDateTime(payment.dataVencimento)),
            xmlTag('VALOR', formatDecimal(payment.valor)),
            xmlTag('IDFORMAPAGTO', payment.idFormaPagto),
            xmlTag('DESCFORMAPAGTO', payment.descFormaPagto),
            xmlTag('TIPOPFORMAPAGTO', payment.tipoFormaPagto),
            xmlTag('CODCXA', payment.codCxa),
            xmlTag('CODCOLCXA', payment.codColCxa ?? entry.header.codColigada),
            xmlTag('TIPOPAGAMENTO', payment.tipoPagamento ?? '1'),
            xmlTag('DEBITOCREDITO', payment.debitoCredito ?? 'C'),
            xmlTag('TAXAADM', formatDecimal(payment.taxaAdm)),
            xmlTag('IDLAN', payment.idLan),
            xmlTag('ADTINTEGRADO', payment.adtIntegrado ?? 'nao'),
            xmlTag('LINHADIGITAVEL', payment.linhaDigitavel),
            '</TMOVPAGTO>',
        ]))
            .join('');
        return joinXml([
            '<MovMovimento>',
            movementXml,
            movementComplXml,
            itemsXml,
            itemsComplXml,
            apportionmentsXml,
            taxesXml,
            paymentsXml,
            '</MovMovimento>',
        ]);
    }
}
exports.RmEntryInvoiceMovementService = RmEntryInvoiceMovementService;
