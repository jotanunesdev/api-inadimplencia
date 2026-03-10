import { AppError } from '../types/errors';

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError(
        504,
        'Tempo limite excedido ao comunicar com o Microsoft Graph.',
        'GRAPH_TIMEOUT'
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
