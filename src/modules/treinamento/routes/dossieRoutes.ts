import { Router } from "express"
import { generate, listCandidates, listCourses } from "../controllers/dossieController"

const router = Router()

router.get("/candidates", listCandidates)
router.get("/courses/:cpf", listCourses)
router.post("/generate", generate)

export default router
