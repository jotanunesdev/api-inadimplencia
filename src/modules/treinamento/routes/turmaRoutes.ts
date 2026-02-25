import { Router } from "express"
import {
  createCollectiveTurma,
  getCollectiveTurmaById,
  listCollectiveTurmas,
  saveCollectiveTurmaEvidencias,
} from "../controllers/turmaController"
import { upload } from "../utils/upload"

const router = Router()

router.post("/", createCollectiveTurma)
router.get("/", listCollectiveTurmas)
router.get("/:turmaId", getCollectiveTurmaById)
router.post("/:turmaId/evidencias", upload.array("files", 20), saveCollectiveTurmaEvidencias)

export default router
