import { Router } from 'express';
import {
  findUserByUsername,
  getHealth,
  getUserPhoto,
  listUsers,
} from '../controllers/m365Controller';
import { ensureConfigured } from '../middlewares/ensureConfigured';
import { validateListUsersQuery } from '../middlewares/validateListUsersQuery';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/health', asyncHandler(getHealth));
router.get(
  '/users',
  ensureConfigured,
  validateListUsersQuery,
  asyncHandler(listUsers)
);
router.get('/users/lookup/:username', ensureConfigured, asyncHandler(findUserByUsername));
router.get('/users/:id/photo', ensureConfigured, asyncHandler(getUserPhoto));

export default router;
