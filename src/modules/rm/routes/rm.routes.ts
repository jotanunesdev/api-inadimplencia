import { Router } from "express";
import { RmController } from "../controllers/RmController";

export const createRmRoutes = (rmController: RmController): Router => {
  const router = Router();

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
