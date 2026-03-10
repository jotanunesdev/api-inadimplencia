import type { RequestHandler } from 'express';
import { parseEstoqueMinPayload } from '../utils/validators';

export const validateEstoqueMinBody: RequestHandler = (req, _res, next) => {
  try {
    parseEstoqueMinPayload(req.body as Record<string, unknown>);
    next();
  } catch (error) {
    next(error);
  }
};
