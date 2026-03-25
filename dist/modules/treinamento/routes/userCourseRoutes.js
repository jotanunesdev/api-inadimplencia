"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userCourseController_1 = require("../controllers/userCourseController");
const router = (0, express_1.Router)();
router.post("/", userCourseController_1.create);
router.put("/:id", userCourseController_1.update);
router.delete("/:id", userCourseController_1.remove);
exports.default = router;
