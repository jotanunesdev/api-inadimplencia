import { Router } from "express"
import {
  list,
  markAsRead,
  markAsUnread,
} from "../controllers/notificationController"

const router = Router()

router.get("/", list)
router.patch("/:id/read", markAsRead)
router.patch("/:id/unread", markAsUnread)

export default router
