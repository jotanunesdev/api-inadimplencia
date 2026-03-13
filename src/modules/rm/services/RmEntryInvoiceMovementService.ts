import { env, buildMissingConfigMessage } from '../config/env';
import { RmDataServerClient } from '../clients/RmDataServerClient';
import { RmService } from './RmService';
import { Xml } from '../utils/Xml';
import type { EntryRecord } from '../../entrada-nota-fiscal/types/models';

interface IntegrationResult {
  primaryKey: string;
  movementId: string;
  raw: unknown;
}

function formatDecimal(value: number | null | undefined): string | null {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null;
  }

  return Number(value).toFixed(4).replace('.', ',');
}

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 19);
}

function xmlTag(tag: string, value: string | null | undefined): string {
  if (value === null || value === undefined || String(value).trim().length === 0) {
    return `<${tag}></${tag}>`;
  }

  return `<${tag}>${Xml.escape(String(value))}</${tag}>`;
}

function joinXml(nodes: Array<string | null | undefined>): string {
  return nodes.filter(Boolean).join('');
}

function buildPrimaryKeyCandidate(value: unknown): string | null {
  if (typeof value === 'string' && value.includes(';')) {
    return value;
  }

  if (typeof value === 'object' && value !== null) {
    for (const nestedValue of Object.values(value)) {
      const found = buildPrimaryKeyCandidate(nestedValue);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

export class RmEntryInvoiceMovementService {
  private readonly rmService = new RmService(
    new RmDataServerClient({
      dbTrustCert: env.DB_TRUST_CERT,
      readViewUrl: env.READVIEW_URL,
      readViewUser: env.READVIEW_USER,
      readViewPassword: env.READVIEW_PASSWORD,
      readViewAction: env.READVIEW_ACTION,
      readViewNamespace: env.READVIEW_NAMESPACE,
      getSchemaAction: env.GETSCHEMA_ACTION,
      readRecordAction: env.READRECORD_ACTION,
      saveRecordAction: env.SAVERECORD_ACTION,
    })
  );

  public async integrate(entry: EntryRecord): Promise<IntegrationResult> {
    if (!env.isConfigured) {
      throw new Error(buildMissingConfigMessage());
    }

    if (!entry.header.codColigada) {
      throw new Error('CODCOLIGADA obrigatorio para integrar a nota no RM.');
    }

    const xml = this.buildMovementXml(entry);
    const context = `CODCOLIGADA=${entry.header.codColigada};CODUSUARIO=${env.READVIEW_USER};CODSISTEMA=G`;
    const raw = await this.rmService.execute({
      operation: 'SaveRecord',
      dataserver: 'MOVMOVIMENTOTBCDATA',
      context,
      xml,
    });

    const primaryKey = buildPrimaryKeyCandidate(raw);
    if (!primaryKey) {
      throw new Error('RM nao retornou a primary key do movimento integrado.');
    }

    const movementId = primaryKey.split(';')[1] ?? '';
    if (!movementId) {
      throw new Error('RM nao retornou o IDMOV do movimento integrado.');
    }

    return {
      primaryKey,
      movementId,
      raw,
    };
  }

  private buildMovementXml(entry: EntryRecord): string {
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

    const itemTotals = new Map(
      entry.items.map((item) => [
        item.seqF ?? item.nseqItmMov ?? String(item.lineNumber),
        Number(item.valorLiquido ?? 0),
      ])
    );

    const itemsXml = entry.items
      .map((item) =>
        joinXml([
          '<TITMMOV>',
          xmlTag('CODCOLIGADA', entry.header.codColigada),
          xmlTag('IDMOV', movementIdPlaceholder),
          xmlTag('NSEQITMMOV', item.nseqItmMov ?? String(item.lineNumber)),
          xmlTag('NUMEROSEQUENCIAL', String(item.lineNumber)),
          xmlTag('CODFILIAL', entry.header.codFilial),
          xmlTag('IDPRD', item.idPrd),
          xmlTag('CODIGOPRD', item.codigoPrd),
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
          xmlTag('VALORLIQUIDO', formatDecimal(item.valorLiquido)),
          xmlTag('HISTORICOCURTO', item.nomeFantasia),
          '</TITMMOV>',
        ])
      )
      .join('');

    const itemsComplXml = entry.items
      .map((item) =>
        joinXml([
          '<TITMMOVCOMPL>',
          xmlTag('CODCOLIGADA', entry.header.codColigada),
          xmlTag('IDMOV', movementIdPlaceholder),
          xmlTag('NSEQITMMOV', item.nseqItmMov ?? String(item.lineNumber)),
          xmlTag('IDMOVOC', item.idMovOc),
          xmlTag('NSEQITMMOVOC', item.nseqItmMovOc),
          '</TITMMOVCOMPL>',
        ])
      )
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
      .map((tax) =>
        joinXml([
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
        ])
      )
      .join('');

    const paymentsXml = entry.payments
      .map((payment, index) =>
        joinXml([
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
        ])
      )
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
