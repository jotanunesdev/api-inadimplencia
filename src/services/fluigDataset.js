const DEFAULT_CONSTRAINT_TYPE = 1;
const fetchApi = global.fetch || require('node-fetch');

function resolveFluigUrl() {
  const url = process.env.FLUIG_URL;
  if (!url) {
    throw new Error('FLUIG_URL nao configurado.');
  }
  return url.replace(/\/$/, '');
}

function resolveAuthHeader() {
  const user = process.env.FLUIG_USER;
  const password = process.env.FLUIG_PASSWORD;

  if (!user || !password) {
    return null;
  }

  const token = Buffer.from(`${user}:${password}`).toString('base64');
  return `Basic ${token}`;
}

function buildConstraint(field, initialValue, finalValue = initialValue, type = DEFAULT_CONSTRAINT_TYPE) {
  return {
    _field: field,
    _initialValue: String(initialValue ?? ''),
    _finalValue: String(finalValue ?? initialValue ?? ''),
    _type: type,
  };
}

async function fetchDataset(name, options = {}) {
  const url = `${resolveFluigUrl()}/api/public/ecm/dataset/datasets`;
  const payload = {
    name,
    fields: options.fields ?? null,
    constraints: options.constraints ?? null,
    order: options.order ?? null,
  };

  const authHeader = resolveAuthHeader();
  const headers = {
    'Content-Type': 'application/json',
  };
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  const response = await fetchApi(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao consultar dataset ${name}: ${text || response.status}`);
  }

  return response.json();
}

module.exports = {
  fetchDataset,
  buildConstraint,
};
