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
function xmlOptionalTag(tag, value) {
    if (value === null || value === undefined || String(value).trim().length === 0) {
        return '';
    }
    return `<${tag}>${Xml_1.Xml.escape(String(value))}</${tag}>`;
}
function joinXml(nodes) {
    return nodes.filter(Boolean).join('');
}
function normalizeRows(value) {
    if (Array.isArray(value)) {
        return value.filter((item) => typeof item === 'object' && item !== null);
    }
    if (typeof value === 'object' && value !== null) {
        return [value];
    }
    return [];
}
function buildOriginItemKey(idMov, nseqItmMov) {
    return `${String(idMov ?? '').trim()}::${String(nseqItmMov ?? '').trim()}`;
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
function buildEntryItemKey(seqF, nseqItmMov) {
    const keys = new Set();
    if (seqF && String(seqF).trim()) {
        keys.add(`seq:${String(seqF).trim()}`);
    }
    if (nseqItmMov && String(nseqItmMov).trim()) {
        keys.add(`nseq:${String(nseqItmMov).trim()}`);
    }
    return Array.from(keys);
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
        const xml = await this.buildMovementXml(entry);
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
    async loadSourceFiscalContext(entry) {
        const sourceMovementIds = Array.from(new Set([
            ...entry.purchaseOrders.map((purchaseOrder) => toCompactString(purchaseOrder.idMov)),
            ...entry.items.map((item) => toCompactString(item.idMovOc)),
        ].filter((value) => Boolean(value))));
        const context = `CODCOLIGADA=${entry.header.codColigada};CODUSUARIO=${env_1.env.READVIEW_USER};CODSISTEMA=G`;
        const sourceRecords = await Promise.all(sourceMovementIds.map((idMov) => this.rmService
            .execute({
            operation: 'ReadRecord',
            dataserver: 'MOVMOVIMENTOTBCDATA',
            context,
            primaryKey: `${entry.header.codColigada};${idMov}`,
        })
            .catch(() => null)));
        const firstRecord = sourceRecords.find((record) => typeof record === 'object' && record !== null) ?? null;
        const itemFiscalByOriginKey = new Map();
        sourceRecords.forEach((record, index) => {
            if (!record || typeof record !== 'object') {
                return;
            }
            const currentSourceMovementId = sourceMovementIds[index] ?? '';
            normalizeRows(record.TITMMOVFISCAL).forEach((itemFiscal) => {
                const itemSequence = toCompactString(itemFiscal.NSEQITMMOV);
                if (!itemSequence) {
                    return;
                }
                itemFiscalByOriginKey.set(buildOriginItemKey(currentSourceMovementId, itemSequence), itemFiscal);
            });
        });
        return {
            movementHeader: firstRecord
                ? normalizeRows(firstRecord.TMOV)[0] ?? null
                : null,
            movementFiscal: firstRecord
                ? normalizeRows(firstRecord.TMOVFISCAL)[0] ?? null
                : null,
            itemFiscalByOriginKey,
        };
    }
    buildCopiedXmlFields(row, excludedFields = []) {
        if (!row) {
            return '';
        }
        const excluded = new Set(excludedFields.map((field) => field.toUpperCase()));
        return Object.entries(row)
            .filter(([key, value]) => {
            const upperKey = key.toUpperCase();
            if (excluded.has(upperKey) ||
                upperKey.startsWith('REC') ||
                value === null ||
                value === undefined) {
                return false;
            }
            return String(value).trim().length > 0;
        })
            .map(([key, value]) => xmlTag(key, String(value)))
            .join('');
    }
    async buildMovementXml(entry) {
        const movementIdPlaceholder = '-1';
        const generatedLink = `entrada-nota-fiscal/${entry.id}`;
        const sourceFiscalContext = await this.loadSourceFiscalContext(entry);
        const rawHeader = entry.header;
        const codUfOper = toCompactString(rawHeader.codUfOper) ??
            toCompactString(sourceFiscalContext.movementHeader?.CODUFOPER);
        const codMunOper = toCompactString(rawHeader.codMunOper) ??
            toCompactString(sourceFiscalContext.movementHeader?.CODMUNOPER);
        const idOperacao = toCompactString(rawHeader.idOperacao) ??
            toCompactString(sourceFiscalContext.movementHeader?.IDOPERACAO);
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
            xmlOptionalTag('CODUFOPER', codUfOper),
            xmlOptionalTag('CODMUNOPER', codMunOper),
            xmlOptionalTag('IDOPERACAO', idOperacao),
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
        const movementFiscalXml = joinXml([
            '<TMOVFISCAL>',
            xmlTag('CODCOLIGADA', entry.header.codColigada),
            xmlTag('IDMOV', movementIdPlaceholder),
            this.buildCopiedXmlFields(sourceFiscalContext.movementFiscal, ['CODCOLIGADA', 'IDMOV']),
            '</TMOVFISCAL>',
        ]);
        const itemTotals = new Map();
        entry.items.forEach((item) => {
            const itemValue = Number(item.valorLiquido ?? 0);
            buildEntryItemKey(item.seqF, item.nseqItmMov).forEach((key) => {
                itemTotals.set(key, itemValue);
            });
        });
        const itemCostCenters = new Map();
        entry.items.forEach((item) => {
            const relatedApportionments = entry.apportionments.filter((apportionment) => {
                const itemKeys = buildEntryItemKey(item.seqF, item.nseqItmMov);
                const apportionmentKeys = buildEntryItemKey(apportionment.itemSeqF, apportionment.nseqItmMov);
                return apportionmentKeys.some((key) => itemKeys.includes(key));
            });
            const uniqueCodes = Array.from(new Set(relatedApportionments
                .map((apportionment) => toCompactString(apportionment.codCcusto))
                .filter((value) => Boolean(value))));
            const costCenterCode = uniqueCodes.length === 1 ? uniqueCodes[0] : null;
            buildEntryItemKey(item.seqF, item.nseqItmMov).forEach((key) => {
                itemCostCenters.set(key, costCenterCode);
            });
        });
        const itemsXml = entry.items
            .map((item) => {
            const itemSequence = item.nseqItmMov ?? String(item.lineNumber);
            const itemKey = buildEntryItemKey(item.seqF, itemSequence)[0] ?? `nseq:${itemSequence}`;
            const itemTotalValue = item.valorTotalItem ?? item.valorBrutoItem;
            const itemLiquidValue = item.valorLiquido ?? itemTotalValue ?? item.valorBrutoItem;
            const costCenterCode = itemCostCenters.get(itemKey) ?? null;
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
                xmlOptionalTag('NUMNOFABRIC', item.numNoFabric),
                xmlOptionalTag('TIPO', item.tipo),
                xmlTag('CODUND', item.codUnd),
                xmlTag('CODLOC', entry.header.codLoc),
                xmlTag('DATAEMISSAO', formatDateTime(entry.header.dataEmissao)),
                xmlTag('IDNAT', item.idNat),
                xmlTag('CODNAT', item.codNat),
                xmlTag('CODTBORCAMENTO', item.codTborcamento),
                xmlTag('CODCOLTBORCAMENTO', item.codColTborcamento),
                xmlOptionalTag('CODCCUSTO', costCenterCode),
                xmlTag('QUANTIDADE', formatDecimal(item.quantidade)),
                xmlTag('PRECOUNITARIO', formatDecimal(item.precoUnitario)),
                xmlTag('VALORBRUTOITEM', formatDecimal(item.valorBrutoItem)),
                xmlTag('VALORTOTALITEM', formatDecimal(itemTotalValue)),
                xmlTag('VALORLIQUIDO', formatDecimal(itemLiquidValue)),
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
            const itemKey = buildEntryItemKey(apportionment.itemSeqF, apportionment.nseqItmMov)[0] ?? '';
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
        const itemTaxesByKey = new Map();
        entry.taxes.forEach((tax) => {
            buildEntryItemKey(tax.itemSeqF, tax.nseqItmMov).forEach((itemKey) => {
                const currentValue = itemTaxesByKey.get(itemKey) ?? 0;
                itemTaxesByKey.set(itemKey, currentValue + Number(tax.valor ?? 0));
            });
        });
        const itemFiscalXml = entry.items
            .map((item) => {
            const itemSequence = item.nseqItmMov ?? String(item.lineNumber);
            const sourceItemFiscal = sourceFiscalContext.itemFiscalByOriginKey.get(buildOriginItemKey(item.idMovOc, item.nseqItmMovOc));
            const itemTaxTotal = itemTaxesByKey.get(`seq:${item.seqF ?? ''}`) ??
                itemTaxesByKey.get(`nseq:${itemSequence}`) ??
                itemTaxesByKey.get(item.seqF ?? itemSequence) ??
                0;
            return joinXml([
                '<TITMMOVFISCAL>',
                xmlTag('CODCOLIGADA', entry.header.codColigada),
                xmlTag('IDMOV', movementIdPlaceholder),
                xmlTag('NSEQITMMOV', itemSequence),
                xmlTag('QTDECONTRATADA', formatDecimal(Number(sourceItemFiscal?.QTDECONTRATADA ?? 0))),
                xmlTag('VLRTOTTRIB', formatDecimal(Number(sourceItemFiscal?.VLRTOTTRIB ?? 0) > 0
                    ? Number(sourceItemFiscal?.VLRTOTTRIB ?? 0)
                    : itemTaxTotal)),
                this.buildCopiedXmlFields(sourceItemFiscal, [
                    'CODCOLIGADA',
                    'IDMOV',
                    'NSEQITMMOV',
                    'QTDECONTRATADA',
                    'VLRTOTTRIB',
                ]),
                '</TITMMOVFISCAL>',
            ]);
        })
            .join('');
        const paymentsXml = entry.header.financeiro
            ? entry.payments
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
                .join('')
            : '';
        return joinXml([
            '<MovMovimento>',
            movementXml,
            movementComplXml,
            movementFiscalXml,
            itemsXml,
            itemsComplXml,
            apportionmentsXml,
            itemFiscalXml,
            taxesXml,
            paymentsXml,
            '</MovMovimento>',
        ]);
    }
}
exports.RmEntryInvoiceMovementService = RmEntryInvoiceMovementService;
