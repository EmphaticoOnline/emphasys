import { Router } from "express";
import { requireAuth, requireEmpresaActiva } from "../../auth/auth.middleware";
import {
  getCodigoPostal,
  getColonias,
  getRegimenesFiscales,
  getUsosCfdi,
  getFormasPago,
  getMetodosPago,
  buscarCodigosPostalesHandler,
} from "./sat.controller";

const router = Router();

router.get("/codigos-postales/:cp", requireAuth, requireEmpresaActiva, getCodigoPostal);
router.get("/codigos-postales", requireAuth, requireEmpresaActiva, buscarCodigosPostalesHandler);
router.get("/colonias", requireAuth, requireEmpresaActiva, getColonias);
router.get("/colonias/:cp", requireAuth, requireEmpresaActiva, getColonias);
router.get("/regimenes-fiscales", requireAuth, requireEmpresaActiva, getRegimenesFiscales);
router.get("/usos-cfdi", requireAuth, requireEmpresaActiva, getUsosCfdi);
router.get("/formas-pago", requireAuth, requireEmpresaActiva, getFormasPago);
router.get("/metodos-pago", requireAuth, requireEmpresaActiva, getMetodosPago);

export default router;
