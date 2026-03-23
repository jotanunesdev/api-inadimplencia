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
import {
  listTrainingWorkflowNotifications,
  markAllTrainingWorkflowNotificationsRead,
  markTrainingWorkflowNotificationAsRead,
  streamTrainingWorkflowNotifications,
} from "../controllers/trainingWorkflowNotificationController"

const router = Router()

router.get("/perfil", listProfileFeedNotifications)
router.get("/perfil/stream", streamProfileFeedNotifications)
router.patch("/perfil/read-all", markAllProfileFeedNotificationsAsRead)
router.patch("/perfil/:id/read", markProfileFeedNotificationAsRead)
router.get("/treinamentos", listTrainingWorkflowNotifications)
router.get("/treinamentos/stream", streamTrainingWorkflowNotifications)
router.patch("/treinamentos/read-all", markAllTrainingWorkflowNotificationsRead)
router.patch("/treinamentos/:id/read", markTrainingWorkflowNotificationAsRead)
router.get("/", list)
router.patch("/:id/read", markAsRead)
router.patch("/:id/unread", markAsUnread)

export default router
