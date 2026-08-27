import { Router } from "express";
import { requireAuth } from "../modules/auth/auth.middleware";
import { runtimeConfig } from "../config/runtime";

const router = Router();

router.get("/runtime-info", requireAuth, (_req, res) => {
  res.json({
    appEnv: runtimeConfig.appEnv,
    dbTarget: runtimeConfig.dbTarget,
  });
});

export default router;
