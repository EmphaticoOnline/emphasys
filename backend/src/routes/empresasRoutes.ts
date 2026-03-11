import { Router } from "express";
import { requireAuth } from "../modules/auth/auth.middleware";
import {
  actualizarEmpresaController,
  crearEmpresaController,
  eliminarEmpresaController,
  getEmpresaPorId,
  getEmpresas,
} from "../controllers/empresasController";

const router = Router();

router.get("/", requireAuth, getEmpresas);
router.get("/:id", requireAuth, getEmpresaPorId);
router.post("/", requireAuth, crearEmpresaController);
router.put("/:id", requireAuth, actualizarEmpresaController);
router.delete("/:id", requireAuth, eliminarEmpresaController);

export default router;
