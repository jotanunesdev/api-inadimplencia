import type { RequestHandler } from 'express';
import { buildMissingConfigMessage, env } from '../config/env';
import { AppError } from '../types/errors';

export const ensureConfigured: RequestHandler = (_req, _res, next) => {
  if (env.isConfigured) {
    next();
    return;
  }

  next(
    new AppError(500, buildMissingConfigMessage(), 'AUTH_NOT_CONFIGURED', {
      missingRequired: env.missingRequired,
    })
  );
};
