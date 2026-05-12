const fetchApi = global.fetch || require('node-fetch');
const { env } = require('../config/env');

const DEFAULT_TIMEOUT_MS = env.SERASA_HTTP_TIMEOUT_MS || 10000;
const TOKEN_TTL_BUFFER_MS = 60000; // 1 minute buffer before token expiration

function buildError(message, statusCode, code, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  Object.assign(error, details);
  return error;
}

function sanitizeError(error) {
  const message = String(error?.message ?? error ?? 'Unknown error');

  // Remove sensitive information from error messages
  const sanitized = message
    .replace(/client_secret[:=]\s*[^\s]+/gi, 'client_secret=***')
    .replace(/Basic\s+[^\s]+/gi, 'Basic ***')
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer ***')
    .replace(/[0-9]{11}/g, '***')
    .replace(/[0-9]{14}/g, '***');

  return sanitized;
}

function sanitizeErrorData(value) {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeError(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeErrorData);
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => {
        if (/secret|authorization|token/i.test(key)) {
          return [key, '***'];
        }
        return [key, sanitizeErrorData(nestedValue)];
      })
    );
  }

  return value;
}

function resolveTokenExpiresAt(expiresIn) {
  const fallbackSeconds = 3600;
  const parsed = Number(expiresIn ?? fallbackSeconds);
  const now = Date.now();
  const expiresInSeconds = Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackSeconds;
  const expiresAtMs = expiresInSeconds > 1_000_000_000
    ? expiresInSeconds * 1000
    : now + (expiresInSeconds * 1000);

  return expiresAtMs - TOKEN_TTL_BUFFER_MS;
}

function createSerasaPefinHttpClient({ fetch: customFetch, timeoutMs = DEFAULT_TIMEOUT_MS, env: customEnv = env } = {}) {
  const fetchImpl = customFetch || fetchApi;
  const currentEnv = customEnv;
  const timeout = timeoutMs;

  let cachedToken = null;
  let tokenExpiresAt = 0;

  function isConfigured() {
    return currentEnv.SERASA_IS_CONFIGURED === true;
  }

  function buildBasicAuth() {
    const clientId = currentEnv.SERASA_CLIENT_ID;
    const clientSecret = currentEnv.SERASA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw buildError(
        'SERASA_PEFIN_NOT_CONFIGURED',
        503,
        'SERASA_PEFIN_NOT_CONFIGURED',
        { missingRequired: currentEnv.SERASA_MISSING_REQUIRED || [] }
      );
    }

    const token = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    return `Basic ${token}`;
  }

  function isTokenValid() {
    if (!cachedToken) {
      return false;
    }
    return Date.now() < tokenExpiresAt;
  }

  async function fetchBearerToken() {
    if (!isConfigured()) {
      throw buildError(
        'SERASA_PEFIN_NOT_CONFIGURED',
        503,
        'SERASA_PEFIN_NOT_CONFIGURED',
        { missingRequired: currentEnv.SERASA_MISSING_REQUIRED || [] }
      );
    }

    const authUrl = currentEnv.SERASA_AUTH_URL;
    const basicAuth = buildBasicAuth();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetchImpl(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: basicAuth,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw buildError(
          `SERASA_PEFIN_AUTH_FAILED: ${response.status}`,
          503,
          'SERASA_PEFIN_AUTH_FAILED',
          { statusCode: response.status, responseBody: sanitizeError(errorText) }
        );
      }

      const data = await response.json();
      const accessToken = data.accessToken || data.access_token;
      const expiresIn = data.expiresIn ?? data.expires_in;

      if (!accessToken) {
        throw buildError(
          'SERASA_PEFIN_AUTH_FAILED: No access token returned',
          503,
          'SERASA_PEFIN_AUTH_FAILED'
        );
      }

      cachedToken = accessToken;
      tokenExpiresAt = resolveTokenExpiresAt(expiresIn);

      return accessToken;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw buildError(
          'SERASA_PEFIN_AUTH_TIMEOUT',
          504,
          'SERASA_PEFIN_AUTH_TIMEOUT'
        );
      }

      if (error.code === 'SERASA_PEFIN_AUTH_FAILED' || error.code === 'SERASA_PEFIN_NOT_CONFIGURED') {
        throw error;
      }

      throw buildError(
        `SERASA_PEFIN_AUTH_FAILED: ${sanitizeError(error)}`,
        503,
        'SERASA_PEFIN_AUTH_FAILED',
        { originalError: sanitizeError(error.message) }
      );
    }
  }

  async function getBearerToken({ forceRefresh = false } = {}) {
    if (!forceRefresh && isTokenValid()) {
      return cachedToken;
    }

    return fetchBearerToken();
  }

  async function postWithRefresh(url, payload, isRetry = false) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const token = await getBearerToken();

      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 401 - token expired, refresh and retry once
      if (response.status === 401 && !isRetry) {
        await getBearerToken({ forceRefresh: true });
        return postWithRefresh(url, payload, true);
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = await response.clone().json();
        } catch {
          errorData = errorText;
        }

        throw buildError(
          `SERASA_PEFIN_HTTP_ERROR: ${response.status}`,
          response.status >= 500 ? 503 : response.status,
          'SERASA_PEFIN_HTTP_ERROR',
          {
            statusCode: response.status,
            responseBody: sanitizeError(errorText),
            errorData: typeof errorData === 'object' ? sanitizeErrorData(errorData) : undefined,
          }
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw buildError(
          'SERASA_PEFIN_HTTP_TIMEOUT',
          504,
          'SERASA_PEFIN_HTTP_TIMEOUT',
          { url, timeout }
        );
      }

      if (error.code === 'SERASA_PEFIN_HTTP_ERROR' || error.code === 'SERASA_PEFIN_AUTH_FAILED') {
        throw error;
      }

      throw buildError(
        `SERASA_PEFIN_HTTP_ERROR: ${sanitizeError(error)}`,
        503,
        'SERASA_PEFIN_HTTP_ERROR',
        { url, originalError: sanitizeError(error.message) }
      );
    }
  }

  async function postDebt(payload) {
    const debtUrl = currentEnv.SERASA_DEBT_URL;

    if (!debtUrl) {
      throw buildError(
        'SERASA_PEFIN_NOT_CONFIGURED: Debt URL not configured',
        503,
        'SERASA_PEFIN_NOT_CONFIGURED'
      );
    }

    return postWithRefresh(debtUrl, payload);
  }

  async function postGuarantor(payload) {
    const guarantorUrl = currentEnv.SERASA_GUARANTOR_URL;

    if (!guarantorUrl) {
      throw buildError(
        'SERASA_PEFIN_NOT_CONFIGURED: Guarantor URL not configured',
        503,
        'SERASA_PEFIN_NOT_CONFIGURED'
      );
    }

    return postWithRefresh(guarantorUrl, payload);
  }

  return {
    getBearerToken,
    postDebt,
    postGuarantor,
    isConfigured,
  };
}

module.exports = {
  createSerasaPefinHttpClient,
};
