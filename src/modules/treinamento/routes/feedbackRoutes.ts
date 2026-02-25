import { Router } from "express"
import {
  getPlatformSatisfactionStatus,
  submitPlatformSatisfaction,
  getTrainingFeedbackDashboardSummary,
} from "../controllers/feedbackController"

const router = Router()

router.get("/platform-satisfaction/status/:cpf", getPlatformSatisfactionStatus)
router.post("/platform-satisfaction", submitPlatformSatisfaction)
router.get("/dashboard-summary", getTrainingFeedbackDashboardSummary)

export default router
