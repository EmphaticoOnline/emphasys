import { Router } from "express";
import { generarReporteAI } from "../controllers/aiReportes.controller";
import { requireAuth } from "../modules/auth/auth.middleware";

const router = Router();

router.post("/reportes", requireAuth, generarReporteAI);

export default router;