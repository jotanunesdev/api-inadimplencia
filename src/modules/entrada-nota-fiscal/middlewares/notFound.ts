import type { Request, Response } from 'express';

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'ENTRY_INVOICE_ROUTE_NOT_FOUND',
      message: 'Endpoint de Entrada de Nota Fiscal nao encontrado.',
    },
  });
}
