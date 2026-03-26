import { Router } from "express"
import {
  create,
  createUpload,
  downloadContent,
  getById,
  list,
  remove,
  update,
  updateUpload,
} from "../controllers/pdfController"
import { upload } from "../utils/upload"

const router = Router()

router.get("/", list)
router.get("/:id", getById)
router.get("/:id/content", downloadContent)
router.post("/", create)
router.post("/upload", upload.single("file"), createUpload)
router.put("/:id", update)
router.put("/:id/upload", upload.single("file"), updateUpload)
router.delete("/:id", remove)

export default router
