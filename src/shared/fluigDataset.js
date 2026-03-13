const fetchApi = global.fetch || require('node-fetch');
const https = require('https');

const DEFAULT_CONSTRAINT_TYPE = 1;
const CONSTRAINT_TYPE_MAP = {
  1: 'MUST',
  2: 'MUST_NOT',
  3: 'SHOULD',
};

const cachedSessions = new Map();

function normalizeEnvPrefix(prefix) {
  const normalized = String(prefix ?? '').trim().replace(/_+$/, '');
  return normalized ? `${normalized}_` : '';
}

function resolveEnvValue(key, prefix = '') {
  const prefixedKey = `${normalizeEnvPrefix(prefix)}${key}`;
  return process.env[prefixedKey] ?? process.env[key];
}

function shouldAllowInsecure(url, prefix) {
  if (!url || !url.startsWith('https://')) {
    return false;
  }

  return String(resolveEnvValue('FLUIG_ALLOW_INSECURE', prefix) || '').toLowerCase() === 'true';
}

function buildRequestOptions(url, prefix) {
  if (!shouldAllowInsecure(url, prefix)) {
    return {};
  }

  return {
    agent: new https.Agent({ rejectUnauthorized: false }),
  };
}

function resolveFluigUrl(prefix) {
  const url = resolveEnvValue('FLUIG_URL', prefix);
  if (!url) {
    throw new Error('FLUIG_URL nao configurado.');
  }

  return url.replace(/\/$/, '');
}

function buildConstraint(field, initialValue, finalValue = initialValue, type = DEFAULT_CONSTRAINT_TYPE) {
  return {
    _field: field,
    _initialValue: String(initialValue ?? ''),
    _finalValue: String(finalValue ?? initialValue ?? ''),
    _type: type,
  };
}

async function createFluigSession(prefix = '') {
  const user = resolveEnvValue('FLUIG_USER', prefix);
  const password = resolveEnvValue('FLUIG_PASSWORD', prefix);

  if (!user || !password) {
    throw new Error('FLUIG_USER e FLUIG_PASSWORD nao configurados.');
  }

  const baseUrl = resolveFluigUrl(prefix);
  const loginUrl = `${baseUrl}/portal/j_security_check`;
  const body = `j_username=${encodeURIComponent(user)}&j_password=${encodeURIComponent(password)}`;

  const response = await fetchApi(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    redirect: 'manual',
    ...buildRequestOptions(baseUrl, prefix),
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

  const session = {
    cookie: cookieHeader,
    createdAt: Date.now(),
  };
  cachedSessions.set(prefix, session);

  return session.cookie;
}

async function getFluigSessionCookie(prefix = '') {
  const cachedSession = cachedSessions.get(prefix);
  if (cachedSession && Date.now() - cachedSession.createdAt < 10 * 60 * 1000) {
    return cachedSession.cookie;
  }

  return createFluigSession(prefix);
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
  const envPrefix = String(options.envPrefix ?? '').trim();
  const baseUrl = resolveFluigUrl(envPrefix);
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
      options.constraints.map((constraint) => constraint._field ?? constraint.fieldName ?? ''),
      true
    );
    appendArrayParams(
      url.searchParams,
      'constraintsInitialValue',
      options.constraints.map((constraint) => constraint._initialValue ?? constraint.initialValue ?? ''),
      true
    );
    appendArrayParams(
      url.searchParams,
      'constraintsFinalValue',
      options.constraints.map((constraint) => constraint._finalValue ?? constraint.finalValue ?? ''),
      true
    );
    appendArrayParams(
      url.searchParams,
      'constraintsType',
      options.constraints.map((constraint) =>
        resolveConstraintType(constraint._type ?? constraint.type ?? DEFAULT_CONSTRAINT_TYPE)
      ),
      true
    );
  }

  const cookie = await getFluigSessionCookie(envPrefix);
  const headers = {
    Accept: 'application/json',
    Cookie: cookie,
  };

  const response = await fetchApi(url.toString(), {
    method: 'GET',
    headers,
    ...buildRequestOptions(baseUrl, envPrefix),
  });

  if (response.status === 401 || response.status === 403) {
    cachedSessions.delete(envPrefix);
    const refreshedCookie = await getFluigSessionCookie(envPrefix);
    const retry = await fetchApi(url.toString(), {
      method: 'GET',
      headers: { ...headers, Cookie: refreshedCookie },
      ...buildRequestOptions(baseUrl, envPrefix),
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
  buildConstraint,
  fetchDataset,
};
