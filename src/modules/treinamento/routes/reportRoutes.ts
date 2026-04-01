import { Router } from "express"
import {
  listObraTrainingOverview,
  listObraPendingTrainingsReport,
  listTrilhaTrainingReport,
  listObraTrainedReport,
  listProcedimentoVersionReport,
  listUserTrainingsReport,
} from "../controllers/reportController"

const router = Router()

router.get("/user-trainings", listUserTrainingsReport)
router.get("/obra-pending", listObraPendingTrainingsReport)
router.get("/obra-trained", listObraTrainedReport)
router.get("/obra-training-overview", listObraTrainingOverview)
router.get("/procedimentos", listProcedimentoVersionReport)
router.get("/trilhas/:trilhaId", listTrilhaTrainingReport)

export default router
