import { Router } from "express";
import { login, me } from "./auth.controller";
import { requireAuth, requireEmpresaActiva } from "./auth.middleware";

const router = Router();

router.post("/login", login);
router.get("/me", requireAuth, requireEmpresaActiva, me);

export default router;
