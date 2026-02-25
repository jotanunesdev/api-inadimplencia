import { Router } from "express"
import { create, getById, list, remove, update } from "../controllers/channelController"

const router = Router()

router.get("/", list)
router.get("/:id", getById)
router.post("/", create)
router.put("/:id", update)
router.delete("/:id", remove)

export default router
