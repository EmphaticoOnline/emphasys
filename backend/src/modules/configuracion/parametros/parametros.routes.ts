import { Router } from "express";
import { requireAuth, requireEmpresaActiva } from "../../auth/auth.middleware";
import {
	actualizarOpcionParametro,
	crearOpcionParametro,
	eliminarOpcionParametro,
	guardarParametroSistema,
	listarOpcionesParametro,
	listarParametrosSistema,
} from "./parametros.controller";

const router = Router();

router.get("/configuracion/parametros", requireAuth, requireEmpresaActiva, listarParametrosSistema);
router.post("/configuracion/parametros", requireAuth, requireEmpresaActiva, guardarParametroSistema);
router.get("/parametros/:parametroId/opciones", requireAuth, listarOpcionesParametro);
router.post("/parametros/:parametroId/opciones", requireAuth, crearOpcionParametro);
router.put("/opciones-parametro/:opcionId", requireAuth, actualizarOpcionParametro);
router.delete("/opciones-parametro/:opcionId", requireAuth, eliminarOpcionParametro);

export default router;