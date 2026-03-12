import type { NextFunction, Request, Response } from 'express';

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof Error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'RM_INTERNAL_SERVER_ERROR',
        message: error.message || 'Erro interno do modulo RM.',
      },
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'RM_INTERNAL_SERVER_ERROR',
      message: 'Erro interno do modulo RM.',
    },
  });
}
