import { Router } from "express"
import {
  createOrVersionObjective,
  create,
  createUpload,
  getLatestObjectiveResult,
  getObjectiveForPlayer,
  getObjectiveByTrilha,
  getById,
  listAttemptsReport,
  list,
  remove,
  submitObjectiveForCollective,
  submitObjectiveForPlayer,
  update,
  updateUpload,
} from "../controllers/provaController"
import { upload } from "../utils/upload"

const router = Router()

router.get("/", list)
router.get("/attempts/report", listAttemptsReport)
router.get("/trilha/:trilhaId/objectiva", getObjectiveByTrilha)
router.get("/trilha/:trilhaId/objectiva/player", getObjectiveForPlayer)
router.get("/trilha/:trilhaId/objectiva/player/result", getLatestObjectiveResult)
router.get("/:id", getById)
router.post("/", create)
router.post("/trilha/:trilhaId/objectiva", createOrVersionObjective)
router.post("/trilha/:trilhaId/objectiva/player/submit", submitObjectiveForPlayer)
router.post("/trilha/:trilhaId/objectiva/instrutor/submit", submitObjectiveForCollective)
router.post("/upload", upload.single("file"), createUpload)
router.put("/:id", update)
router.put("/:id/upload", upload.single("file"), updateUpload)
router.delete("/:id", remove)

export default router
