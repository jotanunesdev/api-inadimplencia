import { env, buildMissingConfigMessage } from '../config/env';
import type { GraphTokenResponse } from '../types/graph';
import { AppError } from '../types/errors';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { logger } from '../utils/logger';

interface CachedAccessToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: CachedAccessToken | null = null;

async function parseTokenError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: string;
      error_description?: string;
    };

    return (
      payload.error_description ||
      payload.error ||
      `Falha ao obter token do Microsoft Graph (${response.status}).`
    );
  } catch (_error) {
    return `Falha ao obter token do Microsoft Graph (${response.status}).`;
  }
}

export async function getAccessToken(): Promise<string> {
  if (!env.isConfigured) {
    throw new AppError(500, buildMissingConfigMessage(), 'M365_NOT_CONFIGURED', {
      missingRequired: env.missingRequired,
    });
  }

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    logger.info('TokenService', 'Token Microsoft Graph obtido do cache em memoria.');
    return cachedToken.accessToken;
  }

  logger.info('TokenService', 'Solicitando novo token Microsoft Graph.');

  const tokenUrl = `https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.AZURE_CLIENT_ID,
    client_secret: env.AZURE_CLIENT_SECRET,
    scope: env.GRAPH_SCOPE,
  });

  const response = await fetchWithTimeout(
    tokenUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    },
    env.HTTP_TIMEOUT_MS
  );

  if (!response.ok) {
    const message = await parseTokenError(response);
    logger.error('TokenService', 'Falha ao obter token Microsoft Graph.', {
      status: response.status,
      message,
    });
    throw new AppError(401, message, 'GRAPH_TOKEN_REQUEST_FAILED');
  }

  const tokenPayload = (await response.json()) as GraphTokenResponse;

  cachedToken = {
    accessToken: tokenPayload.access_token,
    expiresAt: Date.now() + tokenPayload.expires_in * 1000 - env.TOKEN_CACHE_BUFFER_MS,
  };

  return tokenPayload.access_token;
}
