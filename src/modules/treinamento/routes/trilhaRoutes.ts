import { Router } from "express"
import {
  clearEficaciaConfig,
  create,
  getById,
  list,
  remove,
  update,
  upsertEficaciaConfig,
} from "../controllers/trilhaController"

const router = Router()

router.get("/", list)
router.get("/:id", getById)
router.post("/", create)
router.put("/:id", update)
router.put("/:id/eficacia", upsertEficaciaConfig)
router.delete("/:id/eficacia", clearEficaciaConfig)
router.delete("/:id", remove)

export default router
