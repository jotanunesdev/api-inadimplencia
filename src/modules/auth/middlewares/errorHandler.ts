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
      message: error.message,
      code: error.code,
      details: error.details,
    });
    return;
  }

  console.error('Unhandled auth module error:', error);

  res.status(500).json({
    message: 'Erro interno',
    code: 'INTERNAL_SERVER_ERROR',
  });
}
