import { Router } from "express"
import {
  attachCollectiveFaceEvidence,
  listArchivedCompletionReportByFunction,
  listCompletionReportByFunction,
  listCompletedVideosByCpf,
  listVideoCompletions,
  recordCollectiveEficacia,
  recordAttendance,
  recordTrilhaEficacia,
  recordVideoCompletion,
} from "../controllers/userTrainingController"

const router = Router()

router.post("/", recordAttendance)
router.post("/face-evidence", attachCollectiveFaceEvidence)
router.post("/eficacia/trilha", recordTrilhaEficacia)
router.post("/eficacia/turma", recordCollectiveEficacia)
router.post("/complete", recordVideoCompletion)
router.get("/completions/videos", listVideoCompletions)
router.get("/completions/videos/:cpf", listCompletedVideosByCpf)
router.get("/completions/report", listCompletionReportByFunction)
router.get("/completions/report/archived", listArchivedCompletionReportByFunction)

export default router
