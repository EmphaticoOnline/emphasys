import { Request, Response } from "express";
import { getEmpresaActivaId } from "../shared/context/empresa";
import {
  actualizarEtapaConversacion as actualizarEtapaConversacionController,
  actualizarEtiquetaWhatsappController as actualizarEtiquetaWhatsappControllerHandler,
  agregarEtiquetaConversacionWhatsapp as agregarEtiquetaConversacionWhatsappHandler,
  crearEtiquetaWhatsappController as crearEtiquetaWhatsappControllerHandler,
  eliminarEtiquetaWhatsappController as eliminarEtiquetaWhatsappControllerHandler,
  enviarWhatsapp as enviarWhatsappHandler,
  enviarWhatsappPlantilla as enviarWhatsappPlantillaHandler,
  finalizarConversacionWhatsapp as finalizarConversacionWhatsappHandler,
  listarConversacionesWhatsapp as listarConversacionesWhatsappHandler,
  obtenerReglasSeguimientoWhatsapp as obtenerReglasSeguimientoWhatsappHandler,
  listarEtiquetasConversacionWhatsapp as listarEtiquetasConversacionWhatsappHandler,
  listarEtiquetasWhatsapp as listarEtiquetasWhatsappHandler,
  obtenerConversacionWhatsapp as obtenerConversacionWhatsappHandler,
  quitarEtiquetaConversacionWhatsapp as quitarEtiquetaConversacionWhatsappHandler,
  reabrirConversacionWhatsapp as reabrirConversacionWhatsappHandler,
  reenviarMensajeWhatsapp as reenviarMensajeWhatsappHandler,
  whatsappWebhook as whatsappWebhookHandler,
} from "../crm/conversaciones.controller";
import {
  listarPlantillasWhatsapp as listarPlantillasWhatsappRepo,
  crearPlantilla as crearPlantillaRepo,
  actualizarPlantilla as actualizarPlantillaRepo,
  type ParametroPlantilla,
} from "./whatsapp-plantillas.service";

const TIPOS_VALIDOS = [
  "envio_cotizacion",
  "envio_orden_servicio",
  "envio_cfdi",
  "envio_nota_venta",
  "reactivacion",
  "seguimiento",
];

const ORIGENES_VALIDOS = ["manual", "contacto.nombre", "contacto.telefono", "contacto.empresa"] as const;

function parseConfiguracionParametros(raw: unknown): ParametroPlantilla[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item) => ({
      variable: Number(item.variable),
      label: typeof item.label === "string" ? item.label.trim() : `Variable ${item.variable}`,
      origen: ORIGENES_VALIDOS.includes(item.origen as any) ? (item.origen as ParametroPlantilla["origen"]) : "manual",
    }))
    .filter((item) => Number.isFinite(item.variable) && item.variable > 0);
}

export const whatsappWebhook = async (req: Request, res: Response) => {
    console.log("WEBHOOK EJECUTADO", new Date().toISOString());
    return whatsappWebhookHandler(req, res);
};
export const enviarWhatsapp = async (req: Request, res: Response) => enviarWhatsappHandler(req, res);

export const reenviarMensajeWhatsapp = async (req: Request, res: Response) => reenviarMensajeWhatsappHandler(req, res);

export const listarConversacionesWhatsapp = async (req: Request, res: Response) => listarConversacionesWhatsappHandler(req, res);

export const obtenerReglasSeguimientoWhatsapp = async (req: Request, res: Response) => obtenerReglasSeguimientoWhatsappHandler(req, res);

export const obtenerConversacionWhatsapp = async (req: Request, res: Response) => obtenerConversacionWhatsappHandler(req, res);

export const actualizarEtapaConversacion = async (req: Request, res: Response) => actualizarEtapaConversacionController(req, res);

export const finalizarConversacionWhatsapp = async (req: Request, res: Response) => finalizarConversacionWhatsappHandler(req, res);

export const reabrirConversacionWhatsapp = async (req: Request, res: Response) => reabrirConversacionWhatsappHandler(req, res);

export const listarEtiquetasWhatsapp = async (req: Request, res: Response) => listarEtiquetasWhatsappHandler(req, res);

export const crearEtiquetaWhatsappController = async (req: Request, res: Response) => crearEtiquetaWhatsappControllerHandler(req, res);

export const actualizarEtiquetaWhatsappController = async (req: Request, res: Response) => actualizarEtiquetaWhatsappControllerHandler(req, res);

export const eliminarEtiquetaWhatsappController = async (req: Request, res: Response) => eliminarEtiquetaWhatsappControllerHandler(req, res);

export const listarEtiquetasConversacionWhatsapp = async (req: Request, res: Response) => listarEtiquetasConversacionWhatsappHandler(req, res);

export const listarPlantillasWhatsapp = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId ?? getEmpresaActivaId();
    const incluirInactivas = req.query.incluir_inactivas === "1" || req.query.incluir_inactivas === "true";

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    const plantillas = await listarPlantillasWhatsappRepo(empresaId, incluirInactivas);
    return res.status(200).json(plantillas);
  } catch (error) {
    console.error("Error listando plantillas de WhatsApp:", error);
    return res.status(500).json({ message: "No se pudieron obtener las plantillas" });
  }
};

export const crearPlantillaController = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    const { nombre_interno, tipo, proveedor, provider_template_id, es_default, activa } = req.body as Record<string, unknown>;

    if (!nombre_interno || typeof nombre_interno !== "string" || !nombre_interno.trim()) {
      return res.status(400).json({ message: "nombre_interno es requerido" });
    }
    if (!tipo || typeof tipo !== "string" || !TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ message: `tipo debe ser uno de: ${TIPOS_VALIDOS.join(", ")}` });
    }
    if (!proveedor || typeof proveedor !== "string" || !proveedor.trim()) {
      return res.status(400).json({ message: "proveedor es requerido" });
    }
    if (!provider_template_id || typeof provider_template_id !== "string" || !provider_template_id.trim()) {
      return res.status(400).json({ message: "provider_template_id es requerido" });
    }

    const { contenido, configuracion_parametros } = req.body as Record<string, unknown>;

    const plantilla = await crearPlantillaRepo(empresaId, {
      nombre_interno: nombre_interno.trim(),
      tipo,
      proveedor: (proveedor as string).trim(),
      provider_template_id: (provider_template_id as string).trim(),
      es_default: Boolean(es_default),
      activa: activa === undefined ? true : Boolean(activa),
      contenido: typeof contenido === "string" && contenido.trim() ? contenido.trim() : null,
      configuracion_parametros: parseConfiguracionParametros(configuracion_parametros),
    });

    return res.status(201).json(plantilla);
  } catch (error) {
    console.error("Error creando plantilla de WhatsApp:", error);
    return res.status(500).json({ message: "No se pudo crear la plantilla" });
  }
};

export const actualizarPlantillaController = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    const plantillaId = Number(req.params.id);
    if (!Number.isFinite(plantillaId)) {
      return res.status(400).json({ message: "id inválido" });
    }

    const body = req.body as Record<string, unknown>;
    const payload: Record<string, unknown> = {};

    if (body.nombre_interno !== undefined) {
      if (typeof body.nombre_interno !== "string" || !body.nombre_interno.trim()) {
        return res.status(400).json({ message: "nombre_interno no puede estar vacío" });
      }
      payload.nombre_interno = body.nombre_interno.trim();
    }
    if (body.tipo !== undefined) {
      if (!TIPOS_VALIDOS.includes(body.tipo as string)) {
        return res.status(400).json({ message: `tipo debe ser uno de: ${TIPOS_VALIDOS.join(", ")}` });
      }
      payload.tipo = body.tipo;
    }
    if (body.proveedor !== undefined) {
      if (typeof body.proveedor !== "string" || !body.proveedor.trim()) {
        return res.status(400).json({ message: "proveedor no puede estar vacío" });
      }
      payload.proveedor = body.proveedor.trim();
    }
    if (body.provider_template_id !== undefined) {
      if (typeof body.provider_template_id !== "string" || !body.provider_template_id.trim()) {
        return res.status(400).json({ message: "provider_template_id no puede estar vacío" });
      }
      payload.provider_template_id = body.provider_template_id.trim();
    }
    if (body.es_default !== undefined) payload.es_default = Boolean(body.es_default);
    if (body.activa !== undefined) payload.activa = Boolean(body.activa);
    if (body.contenido !== undefined) {
      payload.contenido = typeof body.contenido === "string" && body.contenido.trim() ? body.contenido.trim() : null;
    }
    if (body.configuracion_parametros !== undefined) {
      payload.configuracion_parametros = parseConfiguracionParametros(body.configuracion_parametros);
    }

    const plantilla = await actualizarPlantillaRepo(empresaId, plantillaId, payload);
    if (!plantilla) {
      return res.status(404).json({ message: "Plantilla no encontrada" });
    }

    return res.status(200).json(plantilla);
  } catch (error) {
    console.error("Error actualizando plantilla de WhatsApp:", error);
    return res.status(500).json({ message: "No se pudo actualizar la plantilla" });
  }
};

export const agregarEtiquetaConversacionWhatsapp = async (req: Request, res: Response) => agregarEtiquetaConversacionWhatsappHandler(req, res);

export const quitarEtiquetaConversacionWhatsapp = async (req: Request, res: Response) => quitarEtiquetaConversacionWhatsappHandler(req, res);

export const enviarWhatsappPlantilla = async (req: Request, res: Response) => enviarWhatsappPlantillaHandler(req, res);