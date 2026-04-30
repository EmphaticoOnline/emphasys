import { Router } from "express";
import {
	enviarWhatsapp,
	whatsappWebhook,
	listarConversacionesWhatsapp,
	obtenerReglasSeguimientoWhatsapp,
	obtenerConversacionWhatsapp,
	actualizarEtapaConversacion,
	enviarWhatsappPlantilla,
	listarEtiquetasWhatsapp,
	crearEtiquetaWhatsappController,
	actualizarEtiquetaWhatsappController,
	eliminarEtiquetaWhatsappController,
	listarEtiquetasConversacionWhatsapp,
	agregarEtiquetaConversacionWhatsapp,
	quitarEtiquetaConversacionWhatsapp,
} from "./whatsapp.controller";
import { requireAuth, requireEmpresaActiva } from "../modules/auth/auth.middleware";

const router = Router();

//router.post("/webhook/:token", whatsappWebhook);
router.post("/webhook", whatsappWebhook);
router.post("/enviar-mensaje", requireAuth, requireEmpresaActiva, enviarWhatsapp);
router.post("/enviar-plantilla", requireAuth, requireEmpresaActiva, enviarWhatsappPlantilla);
router.get("/conversaciones", requireAuth, requireEmpresaActiva, listarConversacionesWhatsapp);
router.get("/reglas-seguimiento", requireAuth, requireEmpresaActiva, obtenerReglasSeguimientoWhatsapp);
router.get("/conversacion/:id", requireAuth, requireEmpresaActiva, obtenerConversacionWhatsapp);
router.patch("/conversaciones/:id/etapa", requireAuth, requireEmpresaActiva, actualizarEtapaConversacion);
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