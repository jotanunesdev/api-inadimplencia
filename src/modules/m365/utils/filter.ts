import { AppError } from '../types/errors';
import type { FindUserByUsernameQuery, ListUsersQuery } from '../types/graph';

function parseBooleanValue(value: string, fieldName: string): boolean {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new AppError(
    400,
    `Query param '${fieldName}' deve ser true ou false.`,
    'INVALID_QUERY_PARAM'
  );
}

function parseBooleanQueryValue(
  value: unknown,
  fieldName: string,
  fallback?: boolean
): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return parseBooleanValue(String(value), fieldName);
}

function normalizeOptionalString(value: unknown): string | undefined {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : undefined;
}

function parsePositiveIntegerQueryValue(
  value: unknown,
  fieldName: string,
  fallback: number
): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new AppError(
      400,
      `Query param '${fieldName}' deve ser um numero inteiro positivo.`,
      'INVALID_QUERY_PARAM'
    );
  }

  return parsedValue;
}

function escapeFilterValue(value: string): string {
  return value.replace(/'/g, "''");
}

export function parseListUsersQuery(query: Record<string, unknown>): ListUsersQuery {
  return {
    includePhoto: parseBooleanQueryValue(query.includePhoto, 'includePhoto', false) ?? false,
    department: normalizeOptionalString(query.department),
    accountEnabled: parseBooleanQueryValue(query.accountEnabled, 'accountEnabled'),
    search: normalizeOptionalString(query.search),
    page: parsePositiveIntegerQueryValue(query.page, 'page', 1),
    pageSize: parsePositiveIntegerQueryValue(query.pageSize, 'pageSize', 12),
  };
}

export function parseFindUserByUsernameQuery(
  query: Record<string, unknown>
): FindUserByUsernameQuery {
  return {
    includePhoto:
      parseBooleanQueryValue(query.includePhoto, 'includePhoto', true) ?? true,
  };
}

export function buildUsersFilter(query: Pick<ListUsersQuery, 'department' | 'accountEnabled'>): string | undefined {
  const filters: string[] = [];

  if (query.department) {
    filters.push(`department eq '${escapeFilterValue(query.department)}'`);
  }

  if (typeof query.accountEnabled === 'boolean') {
    filters.push(`accountEnabled eq ${String(query.accountEnabled)}`);
  }

  return filters.length > 0 ? filters.join(' and ') : undefined;
}

export function buildUsernameLookupFilter(username: string): string {
  const normalizedUsername = String(username ?? '').trim().toLowerCase();
  const escapedUsername = escapeFilterValue(normalizedUsername);
  const escapedEmailPrefix = escapeFilterValue(`${normalizedUsername}@`);

  return [
    `mailNickname eq '${escapedUsername}'`,
    `startswith(userPrincipalName,'${escapedEmailPrefix}')`,
    `startswith(mail,'${escapedEmailPrefix}')`,
  ].join(' or ');
}
