"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const feedbackController_1 = require("../controllers/feedbackController");
const router = (0, express_1.Router)();
router.get("/platform-satisfaction/status/:cpf", feedbackController_1.getPlatformSatisfactionStatus);
router.post("/platform-satisfaction", feedbackController_1.submitPlatformSatisfaction);
router.get("/dashboard-summary", feedbackController_1.getTrainingFeedbackDashboardSummary);
exports.default = router;
