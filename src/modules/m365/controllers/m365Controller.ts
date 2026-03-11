import type { Request, Response } from 'express';
import { env } from '../config/env';
import type { ApiSuccessResponse, HealthResponse, ListUsersQuery } from '../types/graph';
import { AppError } from '../types/errors';
import { getUserPhotoById } from '../services/photoService';
import {
  findOrganizationUserByUsername,
  listOrganizationUsers,
} from '../services/userService';
import { parseFindUserByUsernameQuery } from '../utils/filter';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const payload: ApiSuccessResponse<HealthResponse> = {
    success: true,
    data: {
      status: env.isConfigured ? 'ok' : 'degraded',
      module: 'm365',
      configured: env.isConfigured,
      missingRequired: env.missingRequired,
      timestamp: new Date().toISOString(),
    },
  };

  res.status(env.isConfigured ? 200 : 503).json(payload);
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  const query: ListUsersQuery = req.m365Query ?? {
    includePhoto: false,
    page: 1,
    pageSize: 12,
  };

  const result = await listOrganizationUsers(query);

  res.json({
    success: true,
    data: result.users,
    meta: {
      total: result.totalMatched,
      totalAvailable: result.totalAvailable,
      currentPage: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      includePhoto: query.includePhoto,
      filters: {
        department: query.department ?? null,
        accountEnabled:
          typeof query.accountEnabled === 'boolean' ? query.accountEnabled : null,
        search: query.search ?? null,
      },
      graphFilter: result.filter,
      pagesFetched: result.pagesFetched,
      generatedAt: new Date().toISOString(),
    },
  });
}

export async function getUserPhoto(req: Request, res: Response): Promise<void> {
  const userId = String(req.params.id ?? '').trim();

  if (!userId) {
    throw new AppError(400, 'O id do usuario e obrigatorio.', 'INVALID_USER_ID');
  }

  const photo = await getUserPhotoById(userId, { throwOnMissing: true });

  if (!photo) {
    throw new AppError(
      404,
      'Foto de perfil nao encontrada para o usuario informado.',
      'USER_PHOTO_NOT_FOUND'
    );
  }

  res.json({
    success: true,
    data: {
      userId,
      photoBase64: photo.base64,
      contentType: photo.contentType,
      fetchedAt: new Date().toISOString(),
    },
  });
}

export async function findUserByUsername(
  req: Request,
  res: Response
): Promise<void> {
  const username = String(req.params.username ?? '').trim();

  if (!username) {
    throw new AppError(
      400,
      'O username do usuario e obrigatorio.',
      'INVALID_USERNAME'
    );
  }

  const query = parseFindUserByUsernameQuery(
    req.query as Record<string, unknown>
  );
  const result = await findOrganizationUserByUsername(username, query);

  res.json({
    success: true,
    data: result.user,
    meta: {
      includePhoto: query.includePhoto,
      graphFilter: result.filter,
      generatedAt: new Date().toISOString(),
    },
  });
}
