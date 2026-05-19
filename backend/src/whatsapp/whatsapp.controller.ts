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
  listarConversacionesWhatsapp as listarConversacionesWhatsappHandler,
  obtenerReglasSeguimientoWhatsapp as obtenerReglasSeguimientoWhatsappHandler,
  listarEtiquetasConversacionWhatsapp as listarEtiquetasConversacionWhatsappHandler,
  listarEtiquetasWhatsapp as listarEtiquetasWhatsappHandler,
  obtenerConversacionWhatsapp as obtenerConversacionWhatsappHandler,
  quitarEtiquetaConversacionWhatsapp as quitarEtiquetaConversacionWhatsappHandler,
  whatsappWebhook as whatsappWebhookHandler,
} from "../crm/conversaciones.controller";
import { listarPlantillasWhatsapp as listarPlantillasWhatsappRepo } from "./whatsapp-plantillas.service";

export const whatsappWebhook = async (req: Request, res: Response) => whatsappWebhookHandler(req, res);

export const enviarWhatsapp = async (req: Request, res: Response) => enviarWhatsappHandler(req, res);

export const listarConversacionesWhatsapp = async (req: Request, res: Response) => listarConversacionesWhatsappHandler(req, res);

export const obtenerReglasSeguimientoWhatsapp = async (req: Request, res: Response) => obtenerReglasSeguimientoWhatsappHandler(req, res);

export const obtenerConversacionWhatsapp = async (req: Request, res: Response) => obtenerConversacionWhatsappHandler(req, res);

export const actualizarEtapaConversacion = async (req: Request, res: Response) => actualizarEtapaConversacionController(req, res);

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

export const agregarEtiquetaConversacionWhatsapp = async (req: Request, res: Response) => agregarEtiquetaConversacionWhatsappHandler(req, res);

export const quitarEtiquetaConversacionWhatsapp = async (req: Request, res: Response) => quitarEtiquetaConversacionWhatsappHandler(req, res);

export const enviarWhatsappPlantilla = async (req: Request, res: Response) => enviarWhatsappPlantillaHandler(req, res);