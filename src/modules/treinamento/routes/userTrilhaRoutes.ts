import { Router } from "express"
import { assign, listByCpf, remove } from "../controllers/userTrilhaController"

const router = Router()

router.post("/", assign)
router.get("/:cpf", listByCpf)
router.delete("/:cpf/:trilhaId", remove)

export default router
