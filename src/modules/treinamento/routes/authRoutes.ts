import { Router } from "express"
import { login, firstAccess, updatePassword } from "../controllers/authController"

const router = Router()

router.post("/login", login)
router.post("/first-access", firstAccess)
router.put("/password/:cpf", updatePassword)

export default router