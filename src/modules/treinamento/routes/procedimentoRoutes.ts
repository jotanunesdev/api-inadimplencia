import { Router } from "express"
import { upload } from "../utils/upload"
import {
  create,
  createUpload,
  downloadContent,
  getById,
  list,
  listFromFileManager,
  remove,
  update,
  updateUpload,
} from "../controllers/procedimentoController"

const router = Router()

router.get("/", list)
router.get("/from-file-manager", listFromFileManager)
router.get("/:id/content", downloadContent)
router.get("/:id", getById)
router.post("/", create)
router.post("/upload", upload.single("file"), createUpload)
router.put("/:id", update)
router.put("/:id/upload", upload.single("file"), updateUpload)
router.delete("/:id", remove)

export default router
