import { Router } from "express"
import authRoutes from "./authRoutes"
import courseRoutes from "./courseRoutes"
import moduleRoutes from "./moduleRoutes"
import channelRoutes from "./channelRoutes"
import trilhaRoutes from "./trilhaRoutes"
import videoRoutes from "./videoRoutes"
import pdfRoutes from "./pdfRoutes"
import provaRoutes from "./provaRoutes"
import channelVideoRoutes from "./channelVideoRoutes"
import trainingMatrixRoutes from "./trainingMatrixRoutes"
import userRoutes from "./userRoutes"
import userCourseRoutes from "./userCourseRoutes"
import userTrainingRoutes from "./userTrainingRoutes"
import userTrilhaRoutes from "./userTrilhaRoutes"
import procedimentoRoutes from "./procedimentoRoutes"
import userFaceRoutes from "./userFaceRoutes"
import turmaRoutes from "./turmaRoutes"
import normaRoutes from "./normaRoutes"
import notificationRoutes from "./notificationRoutes"
import dossieRoutes from "./dossieRoutes"
import feedbackRoutes from "./feedbackRoutes"
import reportRoutes from "./reportRoutes"

const router = Router()

router.use("/auth", authRoutes)
router.use("/courses", courseRoutes)
router.use("/modules", moduleRoutes)
router.use("/canais", channelRoutes)
router.use("/trilhas", trilhaRoutes)
router.use("/videos", videoRoutes)
router.use("/pdfs", pdfRoutes)
router.use("/provas", provaRoutes)
router.use("/canal-videos", channelVideoRoutes)
router.use("/training-matrix", trainingMatrixRoutes)
router.use("/users", userRoutes)
router.use("/user-courses", userCourseRoutes)
router.use("/user-trainings", userTrainingRoutes)
router.use("/user-trilhas", userTrilhaRoutes)
router.use("/procedimentos", procedimentoRoutes)
router.use("/normas", normaRoutes)
router.use("/faces", userFaceRoutes)
router.use("/turmas", turmaRoutes)
router.use("/notificacoes", notificationRoutes)
router.use("/dossies", dossieRoutes)
router.use("/feedbacks", feedbackRoutes)
router.use("/reports", reportRoutes)

export default router
