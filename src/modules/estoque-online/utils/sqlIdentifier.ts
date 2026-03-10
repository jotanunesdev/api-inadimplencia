import { AppError } from '../types/errors';

const SQL_IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function quoteSqlIdentifier(identifier: string): string {
  if (!SQL_IDENTIFIER_REGEX.test(identifier)) {
    throw new AppError(
      500,
      `Identificador SQL invalido: ${identifier}.`,
      'INVALID_SQL_IDENTIFIER'
    );
  }

  return `[${identifier}]`;
}
