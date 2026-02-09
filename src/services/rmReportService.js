const { fetchDataset, buildConstraint } = require('./fluigDataset');

const DEFAULT_REPORT_ID = Number(process.env.RM_REPORT_ID ?? 21968);
const DEFAULT_REPORT_COLIGADA = Number(process.env.RM_REPORT_COLIGADA ?? process.env.RM_COLIGADA ?? 1);
const DEFAULT_PARAM_COLIGADA = Number(process.env.RM_PARAM_COLIGADA ?? process.env.RM_COLIGADA ?? 1);

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
    values.find((row) => row && (row.RESULTADO || row.resultado)) ?? values[0];
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

  const resolvedReportId = reportId ?? DEFAULT_REPORT_ID;
  const resolvedReportColigada = reportColigada ?? DEFAULT_REPORT_COLIGADA;
  const resolvedParamColigada = codColigada ?? DEFAULT_PARAM_COLIGADA;

  const paramsDataset = await fetchDataset('ds_paramsRel', {
    fields: [String(resolvedReportColigada), String(resolvedReportId)],
  });

  const paramsXml = readParamsXml(paramsDataset);
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
