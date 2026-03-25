"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dossieController_1 = require("../controllers/dossieController");
const router = (0, express_1.Router)();
router.get("/candidates", dossieController_1.listCandidates);
router.get("/courses/:cpf", dossieController_1.listCourses);
router.post("/generate", dossieController_1.generate);
exports.default = router;
