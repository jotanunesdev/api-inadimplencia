"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRmRoutes = void 0;
const express_1 = require("express");
const createRmRoutes = (rmController) => {
    const router = (0, express_1.Router)();
    router.get("/health", rmController.health);
    router.get("/rmjotanunes/:dataserver/partition-options", rmController.partitionOptions);
    router
        .route("/rmjotanunes/:dataserver/:readvieworreadrecord")
        .get(rmController.proxy)
        .post(rmController.proxy)
        .put(rmController.proxy)
        .patch(rmController.proxy)
        .delete(rmController.proxy);
    return router;
};
exports.createRmRoutes = createRmRoutes;
