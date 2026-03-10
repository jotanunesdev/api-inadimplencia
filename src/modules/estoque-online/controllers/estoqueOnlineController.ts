import type { Request, Response } from 'express';
import { env } from '../config/env';
import type { EstoqueMinPayload, EstoqueOnlineKey } from '../types/estoqueOnline';
import {
  createEstoqueMin,
  deleteEstoqueMin,
  getHealthSnapshot,
  getItemByKey,
  listItems,
  updateEstoqueMin,
} from '../services/estoqueOnlineService';

function buildKey(req: Request): EstoqueOnlineKey {
  return {
    codigoPrd: String(req.params.codigoPrd ?? '').trim(),
    codFilial: String(req.params.codFilial ?? '').trim(),
    codLoc: String(req.params.codLoc ?? '').trim(),
  };
}

function buildPayload(req: Request): EstoqueMinPayload {
  return {
    estoqueMin: Number(req.body?.estoqueMin),
  };
}

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const snapshot = await getHealthSnapshot();

  res.status(env.isConfigured ? 200 : 503).json({
    success: true,
    data: {
      status: env.isConfigured ? 'ok' : 'degraded',
      module: 'estoque-online',
      configured: env.isConfigured,
      missingRequired: env.missingRequired,
      estoqueMinColumnAvailable: snapshot.estoqueMinColumnAvailable,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function getAllItems(_req: Request, res: Response): Promise<void> {
  const result = await listItems();

  res.json({
    success: true,
    data: result.items,
    meta: {
      total: result.items.length,
      excludedPrefix: '(NAO USAR)',
      estoqueMinColumnAvailable: result.estoqueMinColumnAvailable,
      generatedAt: new Date().toISOString(),
    },
  });
}

export async function getItem(req: Request, res: Response): Promise<void> {
  const result = await getItemByKey(buildKey(req));

  if (!result.item) {
    res.status(404).json({
      success: false,
      error: {
        code: 'ITEM_NOT_FOUND',
        message: 'Registro nao encontrado na tabela de estoque.',
      },
    });
    return;
  }

  res.json({
    success: true,
    data: result.item,
    meta: {
      estoqueMinColumnAvailable: result.estoqueMinColumnAvailable,
    },
  });
}

export async function postEstoqueMin(req: Request, res: Response): Promise<void> {
  const item = await createEstoqueMin(buildKey(req), buildPayload(req));

  res.status(201).json({
    success: true,
    data: item,
    message: 'ESTOQUEMIN criado com sucesso.',
  });
}

export async function putEstoqueMin(req: Request, res: Response): Promise<void> {
  const item = await updateEstoqueMin(buildKey(req), buildPayload(req));

  res.json({
    success: true,
    data: item,
    message: 'ESTOQUEMIN atualizado com sucesso.',
  });
}

export async function removeEstoqueMin(req: Request, res: Response): Promise<void> {
  const item = await deleteEstoqueMin(buildKey(req));

  res.json({
    success: true,
    data: item,
    message: 'ESTOQUEMIN removido com sucesso.',
  });
}
