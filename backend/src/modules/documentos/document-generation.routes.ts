import { Router } from "express";
import { requireAuth, requireEmpresaActiva } from "../auth/auth.middleware";
import {
  generarDocumentoDesdeOrigen,
  obtenerOpcionesGeneracion,
  prepararGeneracion,
} from "./document-generation.controller";

const router = Router();

router.get("/:documentoId/opciones-generacion", requireAuth, requireEmpresaActiva, obtenerOpcionesGeneracion);
router.get("/:documentoId/preparar-generacion", requireAuth, requireEmpresaActiva, prepararGeneracion);
router.post("/generar-desde-origen", requireAuth, requireEmpresaActiva, generarDocumentoDesdeOrigen);

export default router;
