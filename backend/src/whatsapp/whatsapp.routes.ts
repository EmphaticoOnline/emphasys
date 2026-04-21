import { Router } from "express";
import {
	enviarWhatsapp,
	whatsappWebhook,
	listarConversacionesWhatsapp,
	obtenerConversacionWhatsapp,
	actualizarEtapaConversacion,
	enviarWhatsappPlantilla,
} from "./whatsapp.controller";
import { requireAuth, requireEmpresaActiva } from "../modules/auth/auth.middleware";

const router = Router();

//router.post("/webhook/:token", whatsappWebhook);
router.post("/webhook", whatsappWebhook);
router.post("/enviar-mensaje", requireAuth, requireEmpresaActiva, enviarWhatsapp);
router.post("/enviar-plantilla", requireAuth, requireEmpresaActiva, enviarWhatsappPlantilla);
router.get("/conversaciones", requireAuth, requireEmpresaActiva, listarConversacionesWhatsapp);
router.get("/conversacion/:id", requireAuth, requireEmpresaActiva, obtenerConversacionWhatsapp);
router.patch("/conversaciones/:id/etapa", requireAuth, requireEmpresaActiva, actualizarEtapaConversacion);
export default router;