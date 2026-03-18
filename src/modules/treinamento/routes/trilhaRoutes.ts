import { Router } from "express"
import {
  clearEficaciaConfig,
  create,
  getById,
  list,
  listShares,
  remove,
  update,
  updateShares,
  upsertEficaciaConfig,
} from "../controllers/trilhaController"

const router = Router()

router.get("/", list)
router.get("/:id", getById)
router.get("/:id/shares", listShares)
router.post("/", create)
router.put("/:id", update)
router.put("/:id/shares", updateShares)
router.put("/:id/eficacia", upsertEficaciaConfig)
router.delete("/:id/eficacia", clearEficaciaConfig)
router.delete("/:id", remove)

export default router
