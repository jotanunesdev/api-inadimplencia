import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../types/errors';

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof AppError) {
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

  if (error instanceof Error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'ENTRY_INVOICE_INTERNAL_SERVER_ERROR',
        message: error.message,
      },
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'ENTRY_INVOICE_INTERNAL_SERVER_ERROR',
      message: 'Erro interno do modulo Entrada de Nota Fiscal.',
    },
  });
}
