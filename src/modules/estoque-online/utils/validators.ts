import { AppError } from '../types/errors';
import type { EstoqueMinPayload, EstoqueOnlineKey } from '../types/estoqueOnline';

function normalizeString(value: unknown, fieldName: string): string {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    throw new AppError(400, `O campo '${fieldName}' e obrigatorio.`, 'INVALID_PARAM');
  }

  return normalized;
}

export function parseCompositeKey(source: Record<string, unknown>): EstoqueOnlineKey {
  return {
    codigoPrd: normalizeString(source.codigoPrd, 'codigoPrd'),
    codFilial: normalizeString(source.codFilial, 'codFilial'),
    codLoc: normalizeString(source.codLoc, 'codLoc'),
  };
}

export function parseEstoqueMinPayload(source: Record<string, unknown>): EstoqueMinPayload {
  const rawValue = source.estoqueMin;
  const numericValue = Number(rawValue);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new AppError(
      400,
      "O campo 'estoqueMin' deve ser um numero maior ou igual a zero.",
      'INVALID_BODY'
    );
  }

  return {
    estoqueMin: numericValue,
  };
}
