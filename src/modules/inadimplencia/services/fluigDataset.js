const DEFAULT_CONSTRAINT_TYPE = 1;
const fetchApi = global.fetch || require('node-fetch');
const https = require('https');
const { env } = require('../config/env');

const CONSTRAINT_TYPE_MAP = {
  1: 'MUST',
  2: 'MUST_NOT',
  3: 'SHOULD',
};

let cachedSession = null;

function shouldAllowInsecure(url) {
  if (!url || !url.startsWith('https://')) {
    return false;
  }
  return String(env.FLUIG_ALLOW_INSECURE || '').toLowerCase() === 'true';
}

function buildRequestOptions(url) {
  if (!shouldAllowInsecure(url)) {
    return {};
  }
  return {
    agent: new https.Agent({ rejectUnauthorized: false }),
  };
}

function resolveFluigUrl() {
  const url = env.FLUIG_URL;
  if (!url) {
    throw new Error('FLUIG_URL nao configurado.');
  }
  return url.replace(/\/$/, '');
}

function resolveAuthHeader() {
  const user = env.FLUIG_USER;
  const password = env.FLUIG_PASSWORD;

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

async function createFluigSession() {
  const user = env.FLUIG_USER;
  const password = env.FLUIG_PASSWORD;

  if (!user || !password) {
    throw new Error('FLUIG_USER e FLUIG_PASSWORD nao configurados.');
  }

  const baseUrl = resolveFluigUrl();
  const loginUrl = `${baseUrl}/portal/j_security_check`;
  const body = `j_username=${encodeURIComponent(user)}&j_password=${encodeURIComponent(password)}`;

  const response = await fetchApi(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    redirect: 'manual',
    ...buildRequestOptions(baseUrl),
  });

  if (!response.ok && response.status !== 302) {
    const text = await response.text();
    throw new Error(`Falha ao autenticar no Fluig: ${text || response.status}`);
  }

  const rawSetCookie = response.headers.raw?.()['set-cookie'] ?? response.headers.get('set-cookie');
  const setCookie = Array.isArray(rawSetCookie)
    ? rawSetCookie
    : String(rawSetCookie ?? '').split(/,(?=[^;]+=[^;]+)/g).filter(Boolean);
  if (!setCookie || (Array.isArray(setCookie) && setCookie.length === 0)) {
    throw new Error('Cookie de sessao do Fluig nao retornado.');
  }

  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const cookieHeader = cookies.map((cookie) => String(cookie).split(';')[0]).join('; ');

  cachedSession = {
    cookie: cookieHeader,
    createdAt: Date.now(),
  };

  return cachedSession.cookie;
}

async function getFluigSessionCookie() {
  if (cachedSession && Date.now() - cachedSession.createdAt < 10 * 60 * 1000) {
    return cachedSession.cookie;
  }

  return createFluigSession();
}

function resolveConstraintType(type) {
  if (typeof type === 'string') {
    return type.toUpperCase();
  }
  return CONSTRAINT_TYPE_MAP[type] || 'MUST';
}

function appendArrayParams(params, key, values, includeEmpty = false) {
  values.forEach((value) => {
    if (value === undefined || value === null) {
      return;
    }
    if (!includeEmpty && value === '') {
      return;
    }
    params.append(key, String(value));
  });
}

async function fetchDataset(name, options = {}) {
  const baseUrl = resolveFluigUrl();
  const url = new URL(`${baseUrl}/dataset/api/v2/dataset-handle/search`);

  url.searchParams.set('datasetId', name);

  if (options.fields?.length) {
    appendArrayParams(url.searchParams, 'field', options.fields.map(String));
  }

  if (options.order?.length) {
    appendArrayParams(url.searchParams, 'orderby', options.order.map(String));
  }

  if (options.constraints?.length) {
    appendArrayParams(
      url.searchParams,
      'constraintsField',
      options.constraints.map((c) => c._field ?? c.fieldName ?? ''),
      true,
    );
    appendArrayParams(
      url.searchParams,
      'constraintsInitialValue',
      options.constraints.map((c) => c._initialValue ?? c.initialValue ?? ''),
      true,
    );
    appendArrayParams(
      url.searchParams,
      'constraintsFinalValue',
      options.constraints.map((c) => c._finalValue ?? c.finalValue ?? ''),
      true,
    );
    appendArrayParams(
      url.searchParams,
      'constraintsType',
      options.constraints.map((c) => resolveConstraintType(c._type ?? c.type ?? DEFAULT_CONSTRAINT_TYPE)),
      true,
    );
  }

  const cookie = await getFluigSessionCookie();

  const headers = {
    Accept: 'application/json',
    Cookie: cookie,
  };

  const response = await fetchApi(url.toString(), {
    method: 'GET',
    headers,
    ...buildRequestOptions(baseUrl),
  });

  if (response.status === 401 || response.status === 403) {
    cachedSession = null;
    const refreshedCookie = await getFluigSessionCookie();
    const retry = await fetchApi(url.toString(), {
      method: 'GET',
      headers: { ...headers, Cookie: refreshedCookie },
      ...buildRequestOptions(baseUrl),
    });

    if (!retry.ok) {
      const text = await retry.text();
      throw new Error(`Erro ao consultar dataset ${name}: ${text || retry.status}`);
    }

    return retry.json();
  }

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
