import { Router } from "express";
import {
	enviarWhatsapp,
	whatsappWebhook,
	listarConversacionesWhatsapp,
	obtenerReglasSeguimientoWhatsapp,
	obtenerConversacionWhatsapp,
	actualizarEtapaConversacion,
	finalizarConversacionWhatsapp,
	reabrirConversacionWhatsapp,
	enviarWhatsappPlantilla,
	listarEtiquetasWhatsapp,
	listarPlantillasWhatsapp,
	crearEtiquetaWhatsappController,
	actualizarEtiquetaWhatsappController,
	eliminarEtiquetaWhatsappController,
	listarEtiquetasConversacionWhatsapp,
	agregarEtiquetaConversacionWhatsapp,
	quitarEtiquetaConversacionWhatsapp,
	crearPlantillaController,
	actualizarPlantillaController,
} from "./whatsapp.controller";
import { requireAuth, requireEmpresaActiva, requireSuperadmin } from "../modules/auth/auth.middleware";

const router = Router();

//router.post("/webhook/:token", whatsappWebhook);
router.post("/webhook", whatsappWebhook);
router.post("/enviar-mensaje", requireAuth, requireEmpresaActiva, enviarWhatsapp);
router.post("/enviar-plantilla", requireAuth, requireEmpresaActiva, enviarWhatsappPlantilla);
router.get("/conversaciones", requireAuth, requireEmpresaActiva, listarConversacionesWhatsapp);
router.get("/reglas-seguimiento", requireAuth, requireEmpresaActiva, obtenerReglasSeguimientoWhatsapp);
router.get("/conversacion/:id", requireAuth, requireEmpresaActiva, obtenerConversacionWhatsapp);
router.patch("/conversaciones/:id/etapa", requireAuth, requireEmpresaActiva, actualizarEtapaConversacion);
router.patch("/conversaciones/:id/finalizar", requireAuth, requireEmpresaActiva, finalizarConversacionWhatsapp);
router.patch("/conversaciones/:id/reabrir", requireAuth, requireEmpresaActiva, reabrirConversacionWhatsapp);
router.get("/plantillas", requireAuth, requireEmpresaActiva, listarPlantillasWhatsapp);
router.post("/plantillas", requireAuth, requireSuperadmin, requireEmpresaActiva, crearPlantillaController);
router.put("/plantillas/:id", requireAuth, requireSuperadmin, requireEmpresaActiva, actualizarPlantillaController);
router.get("/etiquetas", requireAuth, requireEmpresaActiva, listarEtiquetasWhatsapp);
router.post("/etiquetas", requireAuth, requireEmpresaActiva, crearEtiquetaWhatsappController);
router.patch("/etiquetas/:id", requireAuth, requireEmpresaActiva, actualizarEtiquetaWhatsappController);
router.delete("/etiquetas/:id", requireAuth, requireEmpresaActiva, eliminarEtiquetaWhatsappController);
router.get("/conversaciones/:id/etiquetas", requireAuth, requireEmpresaActiva, listarEtiquetasConversacionWhatsapp);
router.post("/conversaciones/:id/etiquetas", requireAuth, requireEmpresaActiva, agregarEtiquetaConversacionWhatsapp);
router.delete(
	"/conversaciones/:id/etiquetas/:etiquetaId",
	requireAuth,
	requireEmpresaActiva,
	quitarEtiquetaConversacionWhatsapp
);
export default router;