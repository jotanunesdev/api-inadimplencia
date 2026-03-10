import type { RequestHandler } from 'express';
import { parseCompositeKey } from '../utils/validators';

export const validateKeyParams: RequestHandler = (req, _res, next) => {
  try {
    parseCompositeKey(req.params as Record<string, unknown>);
    next();
  } catch (error) {
    next(error);
  }
};
