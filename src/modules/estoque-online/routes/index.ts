import { Router } from 'express';
import {
  getAllItems,
  getHealth,
  getItem,
  postEstoqueMin,
  putEstoqueMin,
  removeEstoqueMin,
} from '../controllers/estoqueOnlineController';
import { ensureConfigured } from '../middlewares/ensureConfigured';
import { validateEstoqueMinBody } from '../middlewares/validateEstoqueMinBody';
import { validateKeyParams } from '../middlewares/validateKeyParams';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/health', asyncHandler(getHealth));
router.get('/items', ensureConfigured, asyncHandler(getAllItems));
router.get(
  '/items/:codigoPrd/:codFilial/:codLoc',
  ensureConfigured,
  validateKeyParams,
  asyncHandler(getItem)
);
router.post(
  '/items/:codigoPrd/:codFilial/:codLoc/estoque-min',
  ensureConfigured,
  validateKeyParams,
  validateEstoqueMinBody,
  asyncHandler(postEstoqueMin)
);
router.put(
  '/items/:codigoPrd/:codFilial/:codLoc/estoque-min',
  ensureConfigured,
  validateKeyParams,
  validateEstoqueMinBody,
  asyncHandler(putEstoqueMin)
);
router.delete(
  '/items/:codigoPrd/:codFilial/:codLoc/estoque-min',
  ensureConfigured,
  validateKeyParams,
  asyncHandler(removeEstoqueMin)
);

export default router;
