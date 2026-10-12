import { Router } from "express";
import multer from "multer";
import { subirImagen } from "../modules/uploads/uploads.controller";
import { createDiskUploader, DEFAULT_UPLOAD_MIME_TYPES, resolveUploadsDir } from "../modules/uploads/uploads.multer";
import {
	enviarWhatsapp,
	reaccionarMensajeWhatsapp,
	reenviarMensajeWhatsapp,
	whatsappWebhook,
	listarConversacionesWhatsapp,
	marcarConversacionLeidaWhatsapp,
	obtenerReglasSeguimientoWhatsapp,
	obtenerConversacionWhatsapp,
	actualizarEtapaConversacion,
	finalizarConversacionWhatsapp,
	reabrirConversacionWhatsapp,
	enviarWhatsappPlantilla,
	listarEtiquetasWhatsapp,
	listarPlantillasWhatsapp,
	obtenerContextoParametrosWhatsappController,
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
import { analizarTemperatura, obtenerTemperatura } from "../modules/leads/temperatura.controller";

const router = Router();

// Catálogo exclusivo del chat CRM. No se agrega XML a /api/uploads porque ese
// endpoint es compartido por otros módulos del ERP.
const chatUpload = createDiskUploader({
	allowedMimeTypes: [...DEFAULT_UPLOAD_MIME_TYPES, "application/xml", "text/xml"],
	maxFileSizeBytes: 16 * 1024 * 1024,
	destinationDir: resolveUploadsDir(),
});

router.post("/subir-adjunto-chat", requireAuth, requireEmpresaActiva, (req, res, next) => {
	chatUpload.single("file")(req, res, (err: any) => {
		if (err instanceof multer.MulterError) {
			return res.status(400).json({ message: err.code === "LIMIT_FILE_SIZE" ? "El archivo excede el límite de 16 MB" : err.message });
		}
		if (err?.code === "INVALID_FILE_TYPE") return res.status(400).json({ message: "Tipo de archivo no permitido" });
		if (err) {
			console.error("[WhatsApp Chat Upload] Error al guardar archivo", { message: err.message, code: err.code });
			return res.status(500).json({ message: "Error al guardar archivo" });
		}
		if (!req.file) return res.status(400).json({ message: "Archivo no enviado" });
		return next();
	});
}, subirImagen);

//router.post("/webhook/:token", whatsappWebhook);
router.post("/webhook", whatsappWebhook);
router.post("/enviar-mensaje", requireAuth, requireEmpresaActiva, enviarWhatsapp);
router.post("/reenviar-mensaje", requireAuth, requireEmpresaActiva, reenviarMensajeWhatsapp);
router.post("/mensaje/:id/reaccion", requireAuth, requireEmpresaActiva, reaccionarMensajeWhatsapp);
router.post("/enviar-plantilla", requireAuth, requireEmpresaActiva, enviarWhatsappPlantilla);
router.get("/conversaciones", requireAuth, requireEmpresaActiva, listarConversacionesWhatsapp);
router.post("/conversaciones/:id/leer", requireAuth, requireEmpresaActiva, marcarConversacionLeidaWhatsapp);
router.get("/reglas-seguimiento", requireAuth, requireEmpresaActiva, obtenerReglasSeguimientoWhatsapp);
router.get("/conversacion/:id", requireAuth, requireEmpresaActiva, obtenerConversacionWhatsapp);
router.get("/conversaciones/:id/temperatura", requireAuth, requireEmpresaActiva, obtenerTemperatura);
router.post("/conversaciones/:id/temperatura", requireAuth, requireEmpresaActiva, analizarTemperatura);
router.patch("/conversaciones/:id/etapa", requireAuth, requireEmpresaActiva, actualizarEtapaConversacion);
router.patch("/conversaciones/:id/finalizar", requireAuth, requireEmpresaActiva, finalizarConversacionWhatsapp);
router.patch("/conversaciones/:id/reabrir", requireAuth, requireEmpresaActiva, reabrirConversacionWhatsapp);
router.get("/plantillas", requireAuth, requireEmpresaActiva, listarPlantillasWhatsapp);
router.get("/plantillas/contexto-contacto/:contactoId", requireAuth, requireEmpresaActiva, obtenerContextoParametrosWhatsappController);
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
