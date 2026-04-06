import { Router } from "express"
import {
  calculateFileReadingTime,
  create,
  createYouTubeLink,
  completeUploadFileSession,
  getItemContent,
  getItemVersionImpact,
  initUploadFileSession,
  listFolderShares,
  listFolderContents,
  list,
  permanentlyDeleteTrashedItem,
  remove,
  removeItem,
  restoreTrashedItem,
  shareFolder,
  toggleFavoriteFolder,
  uploadFile,
  update,
  versionItem,
} from "../controllers/sectorFolderController"
import { upload } from "../utils/upload"

const router = Router()

router.get("/folders", list)
router.get("/contents", listFolderContents)
router.get("/folders/:itemId/shares", listFolderShares)
router.get("/items/:itemId/content", getItemContent)
router.get("/items/:itemId/version-impact", getItemVersionImpact)
router.post("/folders", create)
router.post("/files/reading-time", upload.single("file"), calculateFileReadingTime)
router.post("/files/upload/session", initUploadFileSession)
router.post("/files/upload/session/:sessionId/complete", completeUploadFileSession)
router.post("/files/upload", upload.single("file"), uploadFile)
router.post("/links/youtube", createYouTubeLink)
router.post("/items/:itemId/version", upload.single("file"), versionItem)
router.patch("/folders/:itemId/favorite", toggleFavoriteFolder)
router.patch("/folders/:itemId", update)
router.post("/trash/:itemId/restore", restoreTrashedItem)
router.put("/folders/:itemId/shares", shareFolder)
router.delete("/trash/:itemId/permanent", permanentlyDeleteTrashedItem)
router.delete("/folders/:itemId", remove)
router.delete("/items/:itemId", removeItem)

export default router
