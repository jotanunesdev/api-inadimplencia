import { Router } from "express"
import {
  listMessages,
  postMessage,
  reactToMessage,
} from "../controllers/profileMessageController"

const router = Router()

router.get("/messages", listMessages)
router.post("/messages", postMessage)
router.put("/messages/:id/reaction", reactToMessage)

export default router
