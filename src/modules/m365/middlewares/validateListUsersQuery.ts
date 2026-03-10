import type { RequestHandler } from 'express';
import { parseListUsersQuery } from '../utils/filter';

export const validateListUsersQuery: RequestHandler = (req, _res, next) => {
  try {
    req.m365Query = parseListUsersQuery(req.query as Record<string, unknown>);
    next();
  } catch (error) {
    next(error);
  }
};
