import type { ListUsersQuery } from './graph';

declare global {
  namespace Express {
    interface Request {
      m365Query?: ListUsersQuery;
    }
  }
}

export {};
