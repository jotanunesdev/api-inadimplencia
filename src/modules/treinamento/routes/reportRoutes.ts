import { Router } from "express"
import {
  listObraTrainingOverview,
  listObraPendingTrainingsReport,
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

export default router
