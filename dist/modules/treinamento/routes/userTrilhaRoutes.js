"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userTrilhaController_1 = require("../controllers/userTrilhaController");
const router = (0, express_1.Router)();
router.post("/", userTrilhaController_1.assign);
router.get("/:cpf", userTrilhaController_1.listByCpf);
router.delete("/:cpf/:trilhaId", userTrilhaController_1.remove);
exports.default = router;
