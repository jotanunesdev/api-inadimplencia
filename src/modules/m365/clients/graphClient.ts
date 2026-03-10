import { env } from '../config/env';
import { getAccessToken } from '../services/tokenService';
import type { GraphErrorEnvelope } from '../types/graph';
import { AppError } from '../types/errors';
import { buildGraphUrl } from '../utils/graphUrl';
import { logger } from '../utils/logger';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

interface GraphBinaryResponse {
  buffer: ArrayBuffer;
  contentType: string | null;
}

async function parseGraphErrorResponse(response: Response): Promise<{
  code?: string;
  message: string;
}> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      const payload = (await response.json()) as GraphErrorEnvelope;
      return {
        code: payload.error?.code,
        message:
          payload.error?.message ||
          `Microsoft Graph respondeu com status ${response.status}.`,
      };
    } catch (_error) {
      return {
        message: `Microsoft Graph respondeu com status ${response.status}.`,
      };
    }
  }

  const rawText = await response.text();

  return {
    message: rawText || `Microsoft Graph respondeu com status ${response.status}.`,
  };
}

export class GraphClient {
  async getJson<TResponse>(pathOrUrl: string): Promise<TResponse> {
    const response = await this.executeRequest(pathOrUrl, 'application/json');
    return (await response.json()) as TResponse;
  }

  async getBinary(pathOrUrl: string): Promise<GraphBinaryResponse> {
    const response = await this.executeRequest(pathOrUrl, 'application/octet-stream');

    return {
      buffer: await response.arrayBuffer(),
      contentType: response.headers.get('content-type'),
    };
  }

  private async executeRequest(pathOrUrl: string, accept: string): Promise<Response> {
    const accessToken = await getAccessToken();
    const url = buildGraphUrl(env.GRAPH_BASE_URL, pathOrUrl);

    logger.info('GraphClient', `GET ${url}`);

    const response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: accept,
        },
      },
      env.HTTP_TIMEOUT_MS
    );

    if (response.ok) {
      return response;
    }

    const graphError = await parseGraphErrorResponse(response);
    const details = {
      status: response.status,
      code: graphError.code,
      message: graphError.message,
    };

    logger.warn('GraphClient', 'Falha em requisicao ao Microsoft Graph.', details);

    if (response.status === 401) {
      throw new AppError(
        401,
        'Falha de autenticacao com o Microsoft Graph.',
        'GRAPH_UNAUTHORIZED',
        details
      );
    }

    if (response.status === 403) {
      throw new AppError(
        403,
        'Permissao insuficiente para acessar o Microsoft Graph.',
        'GRAPH_FORBIDDEN',
        details
      );
    }

    if (response.status === 404) {
      throw new AppError(404, graphError.message, 'GRAPH_NOT_FOUND', details);
    }

    if (response.status === 429) {
      throw new AppError(
        429,
        'Limite de requisicoes do Microsoft Graph atingido. Tente novamente em instantes.',
        'GRAPH_RATE_LIMIT',
        {
          ...details,
          retryAfter: response.headers.get('retry-after'),
        }
      );
    }

    throw new AppError(
      response.status >= 500 ? 502 : response.status,
      graphError.message,
      'GRAPH_REQUEST_FAILED',
      details
    );
  }
}

export const graphClient = new GraphClient();
