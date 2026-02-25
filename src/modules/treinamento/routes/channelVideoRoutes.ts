import { Router } from "express"
import {
  completeSharePointUploadSession,
  create,
  createUpload,
  getById,
  initSharePointUploadSession,
  list,
  remove,
  update,
  updateUpload,
} from "../controllers/channelVideoController"
import { upload } from "../utils/upload"

const router = Router()

router.get("/", list)
router.get("/:id", getById)
router.post("/", create)
router.post("/upload/session", initSharePointUploadSession)
router.post("/upload/session/:sessionId/complete", completeSharePointUploadSession)
router.post("/upload", upload.single("file"), createUpload)
router.put("/:id", update)
router.put("/:id/upload", upload.single("file"), updateUpload)
router.delete("/:id", remove)

export default router
