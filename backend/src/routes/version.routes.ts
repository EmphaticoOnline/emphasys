import { Router } from "express";
import { FRONTEND_BUILD_VERSION } from "../config/version";

const router = Router();

router.get("/", (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.json({ version: FRONTEND_BUILD_VERSION });
});

export default router;