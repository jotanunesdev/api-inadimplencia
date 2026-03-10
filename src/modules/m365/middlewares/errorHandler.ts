import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../types/errors';
import { logger } from '../utils/logger';

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof AppError) {
    logger.warn('M365ErrorHandler', error.message, {
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
    });

    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  logger.error('M365ErrorHandler', 'Erro nao tratado no modulo M365.', error);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno do servidor.',
    },
  });
}
