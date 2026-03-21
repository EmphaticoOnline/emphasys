import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { sugerirMensaje } from "./leads.controller";

const router = Router();

router.post("/sugerir-mensaje", requireAuth, sugerirMensaje);

export default router;
