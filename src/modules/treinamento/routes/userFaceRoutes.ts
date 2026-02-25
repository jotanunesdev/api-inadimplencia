import { Router } from "express"
import { enrollFace, listFaces, matchFace } from "../controllers/userFaceController"

const router = Router()

router.get("/", listFaces)
router.get("/:cpf", listFaces)
router.post("/enroll", enrollFace)
router.post("/match", matchFace)

export default router
