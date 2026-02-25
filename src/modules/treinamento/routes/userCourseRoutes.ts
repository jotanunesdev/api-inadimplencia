import { Router } from "express"
import { create, remove, update } from "../controllers/userCourseController"

const router = Router()

router.post("/", create)
router.put("/:id", update)
router.delete("/:id", remove)

export default router