import { Router } from "express";
import { changePassword, login, me } from "./auth.controller";
import { requireAuth, requireEmpresaActiva } from "./auth.middleware";

const router = Router();

router.post("/login", login);
router.get("/me", requireAuth, requireEmpresaActiva, me);
router.post("/change-password", requireAuth, changePassword);

export default router;
