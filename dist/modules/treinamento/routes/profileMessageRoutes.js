"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const profileMessageController_1 = require("../controllers/profileMessageController");
const router = (0, express_1.Router)();
router.get("/messages", profileMessageController_1.listMessages);
router.post("/messages", profileMessageController_1.postMessage);
router.put("/messages/:id/reaction", profileMessageController_1.reactToMessage);
exports.default = router;
