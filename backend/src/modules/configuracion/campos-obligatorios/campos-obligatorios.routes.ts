import { Router } from "express";
import { requireAuth, requireEmpresaActiva } from "../../auth/auth.middleware";
import {
  getCamposObligatorios,
  postCampoObligatorio,
  deleteCampoObligatorio,
} from "./campos-obligatorios.controller";

const router = Router();

router.get(
  "/configuracion/campos-obligatorios",
  requireAuth,
  requireEmpresaActiva,
  getCamposObligatorios
);

router.post(
  "/configuracion/campos-obligatorios",
  requireAuth,
  requireEmpresaActiva,
  postCampoObligatorio
);

router.delete(
  "/configuracion/campos-obligatorios",
  requireAuth,
  requireEmpresaActiva,
  deleteCampoObligatorio
);

export default router;
