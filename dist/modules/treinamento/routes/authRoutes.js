"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const router = (0, express_1.Router)();
router.post("/login", authController_1.login);
router.post("/first-access", authController_1.firstAccess);
router.put("/password/:cpf", authController_1.updatePassword);
exports.default = router;
