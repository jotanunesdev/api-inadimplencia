import { Router } from "express"
import {
  create,
  listFolderContents,
  list,
  remove,
  removeItem,
  uploadFile,
  update,
} from "../controllers/sectorFolderController"
import { upload } from "../utils/upload"

const router = Router()

router.get("/folders", list)
router.get("/contents", listFolderContents)
router.post("/folders", create)
router.post("/files/upload", upload.single("file"), uploadFile)
router.patch("/folders/:itemId", update)
router.delete("/folders/:itemId", remove)
router.delete("/items/:itemId", removeItem)

export default router
