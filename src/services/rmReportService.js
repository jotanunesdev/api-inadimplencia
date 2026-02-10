const { fetchDataset, buildConstraint } = require('./fluigDataset');

const DEFAULT_REPORT_ID = Number(process.env.RM_REPORT_ID ?? 21968);
const DEFAULT_REPORT_CODE = String(process.env.RM_REPORT_CODE ?? 21968);
const DEFAULT_REPORT_NAME = String(process.env.RM_REPORT_NAME ?? 'Ficha Financeira');
const DEFAULT_REPORT_COLIGADA = Number(process.env.RM_REPORT_COLIGADA ?? process.env.RM_COLIGADA ?? 1);
const DEFAULT_PARAM_COLIGADA = Number(process.env.RM_PARAM_COLIGADA ?? process.env.RM_COLIGADA ?? 1);

function normalizeReportName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function parseReportEntry(entry) {
  const parts = String(entry ?? '')
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length < 5) {
    return null;
  }

  return {
    reportColigada: Number(parts[0]),
    codSistema: parts[1],
    sistema: parts[2],
    reportId: Number(parts[3]),
    reportCode: parts[4],
    descricao: parts.slice(5).join(' | ') || '',
  };
}

async function resolveReportMeta() {
  const dataset = await fetchDataset('ds_paiFilho_controleDeAcessoRMreportsFluig');
  const rows = dataset?.values ?? [];
  const entries = rows.flatMap((row) => String(row?.table_relatorio ?? '').split('\u0018'));

  const parsed = entries
    .map(parseReportEntry)
    .filter(Boolean);

  const normalizedName = normalizeReportName(DEFAULT_REPORT_NAME);

  let match = null;
  if (DEFAULT_REPORT_CODE) {
    match = parsed.find((item) => String(item.reportCode) === DEFAULT_REPORT_CODE) ?? null;
  }

  if (!match && normalizedName) {
    match = parsed.find((item) => normalizeReportName(item.descricao).includes(normalizedName)) ?? null;
  }

  return match;
}

function isReportNotFound(error) {
  const message = String(error?.message ?? error ?? '');
  return message.toLowerCase().includes('relat') && message.toLowerCase().includes('nao localizado');
}

async function tryFetchParamsXml(reportColigada, reportId) {
  try {
    const dataset = await fetchDataset('ds_paramsRel', {
      fields: [String(reportColigada), String(reportId)],
    });
    const xml = readParamsXml(dataset);
    return { xml, reportColigada, reportId, error: null };
  } catch (error) {
    return { xml: null, reportColigada, reportId, error };
  }
}

function buildReportNotFoundError(attempts) {
  const details = attempts
    .map((attempt) => `coligada=${attempt.reportColigada}, id=${attempt.reportId}`)
    .join(' | ');
  return new Error(`Relatorio nao localizado. Tentativas: ${details}`);
}

function normalizeXml(xml) {
  const replacements = [
    ['arrayofrptparameterreportpar', 'ArrayOfRptParameterReportPar'],
    ['rptparameterreportpar', 'RptParameterReportPar'],
    ['description', 'Description'],
    ['paramname', 'ParamName'],
    ['type', 'Type'],
    ['data', 'Data'],
    ['unityType', 'UnityType'],
    ['assemblyname', 'AssemblyName'],
    ['value', 'Value'],
    ['visible', 'Visible'],
    ['i:Type', 'i:type'],
    ['z:factoryType=', 'z:FactoryType='],
    ['http://schemas.Datacontract.org', 'http://schemas.datacontract.org'],
    ['xmlns=\"http://www.w3.org/1999/xhtml\"', ''],
  ];

  let normalized = String(xml ?? '');
  replacements.forEach(([from, to]) => {
    while (normalized.includes(from)) {
      normalized = normalized.replace(from, to);
    }
  });
  return normalized;
}

function resolveParamValue(paramName, codColigada, numVenda) {
  const normalized = String(paramName ?? '').trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.includes('colig')) {
    return String(codColigada);
  }

  if (normalized.includes('venda')) {
    return String(numVenda);
  }

  return null;
}

function applyParamValues(xml, codColigada, numVenda) {
  const normalizedXml = normalizeXml(xml);
  return normalizedXml.replace(
    /<RptParameterReportPar>([\s\S]*?)<\/RptParameterReportPar>/gi,
    (block, inner) => {
      const nameMatch = inner.match(/<ParamName>([\s\S]*?)<\/ParamName>/i);
      if (!nameMatch) {
        return block;
      }
      const value = resolveParamValue(nameMatch[1], codColigada, numVenda);
      if (!value) {
        return block;
      }
      return block.replace(/<Value>[\s\S]*?<\/Value>/i, `<Value>${value}</Value>`);
    },
  );
}

function readDatasetError(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const first = values[0] ?? {};
  return (
    first.ERRO ||
    first.ERROR ||
    first.error ||
    first.Error ||
    null
  );
}

function readParamsXml(dataset) {
  const values = dataset?.values ?? [];
  const error = readDatasetError(values);
  if (error) {
    throw new Error(String(error));
  }

  const record =
    values.find((row) => {
      const xmlValue = row?.RESULTADO ?? row?.resultado ?? '';
      return String(xmlValue).includes('RptParameterReportPar');
    }) ??
    values.find((row) => row && (row.RESULTADO || row.resultado)) ??
    values[0];

  const xml = record?.RESULTADO ?? record?.resultado ?? '';
  if (!xml) {
    throw new Error('Parametros do relatorio nao encontrados.');
  }
  return xml;
}

async function fetchFichaFinanceiraUrl({ numVenda, codColigada, reportId, reportColigada } = {}) {
  if (!numVenda) {
    throw new Error('NUM_VENDA e obrigatorio.');
  }

  let resolvedReportId = reportId ?? DEFAULT_REPORT_ID;
  let resolvedReportColigada = reportColigada ?? DEFAULT_REPORT_COLIGADA;
  const resolvedParamColigada = codColigada ?? DEFAULT_PARAM_COLIGADA;

  const attempts = [];
  let paramsResult = await tryFetchParamsXml(resolvedReportColigada, resolvedReportId);
  attempts.push(paramsResult);

  if (!paramsResult.xml && isReportNotFound(paramsResult.error)) {
    const meta = await resolveReportMeta();
    if (meta) {
      resolvedReportId = meta.reportId;
      resolvedReportColigada = meta.reportColigada;
      paramsResult = await tryFetchParamsXml(resolvedReportColigada, resolvedReportId);
      attempts.push(paramsResult);
    }
  }

  if (!paramsResult.xml && isReportNotFound(paramsResult.error)) {
    const alternateColigada = resolvedReportColigada === 0 ? 1 : 0;
    paramsResult = await tryFetchParamsXml(alternateColigada, resolvedReportId);
    attempts.push(paramsResult);
    if (paramsResult.xml) {
      resolvedReportColigada = alternateColigada;
    }
  }

  if (!paramsResult.xml) {
    if (paramsResult.error && !isReportNotFound(paramsResult.error)) {
      throw paramsResult.error;
    }
    throw buildReportNotFoundError(attempts);
  }

  const paramsXml = paramsResult.xml;
  const resolvedXml = applyParamValues(paramsXml, resolvedParamColigada, numVenda);

  const constraints = [
    buildConstraint('OPC', 6),
    buildConstraint('REPORT', resolvedReportId),
    buildConstraint('COLIGADA', resolvedReportColigada),
    buildConstraint('PARAMETER', resolvedXml),
    buildConstraint('FILE', 'Report.pdf'),
    buildConstraint('FILTRO', ''),
  ];

  const reportDataset = await fetchDataset('dsIntegraFacilRM', {
    constraints,
  });

  const values = reportDataset?.values ?? [];
  const error = readDatasetError(values);
  if (error) {
    throw new Error(String(error));
  }

  const url = values[0]?.RETORNO ?? values[0]?.retorno;
  if (!url) {
    throw new Error('Relatorio nao retornou URL.');
  }

  return url;
}

module.exports = {
  fetchFichaFinanceiraUrl,
};
