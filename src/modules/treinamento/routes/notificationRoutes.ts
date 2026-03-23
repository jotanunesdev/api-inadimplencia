import { Router } from "express"
import {
  list,
  markAsRead,
  markAsUnread,
} from "../controllers/notificationController"
import {
  listProfileFeedNotifications,
  markAllProfileFeedNotificationsAsRead,
  markProfileFeedNotificationAsRead,
  streamProfileFeedNotifications,
} from "../controllers/profileNotificationController"

const router = Router()

router.get("/perfil", listProfileFeedNotifications)
router.get("/perfil/stream", streamProfileFeedNotifications)
router.patch("/perfil/read-all", markAllProfileFeedNotificationsAsRead)
router.patch("/perfil/:id/read", markProfileFeedNotificationAsRead)
router.get("/", list)
router.patch("/:id/read", markAsRead)
router.patch("/:id/unread", markAsUnread)

export default router
