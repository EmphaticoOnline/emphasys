import type { Request, Response } from 'express';
import { CFDI_SAT_AUTORIZACION_TEXTO, CFDI_SAT_AUTORIZACION_VERSION } from './cfdi-sat-autorizacion-texto';
import {
  obtenerAutorizacionVigente,
  registrarAceptacion,
  type CfdiSatAutorizacionRow,
} from './cfdi-sat-autorizacion.repository';
import { registrarBitacora } from './cfdi-sat-bitacora.repository';
import { assertEsAdministrador, CfdiSatPermisoError, getEmpresaId, getUserId } from './cfdi-sat.shared';

function toPublicAutorizacion(row: CfdiSatAutorizacionRow | null) {
  return {
    version: CFDI_SAT_AUTORIZACION_VERSION,
    texto: CFDI_SAT_AUTORIZACION_TEXTO,
    aceptada: Boolean(row),
    aceptado_en: row?.aceptado_en ?? null,
    aceptado_por: row?.usuario_nombre ?? null,
  };
}

export async function obtenerAutorizacionController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const row = await obtenerAutorizacionVigente(empresaId, CFDI_SAT_AUTORIZACION_VERSION);
    return res.json(toPublicAutorizacion(row));
  } catch (error) {
    console.error('[CFDI SAT] Error al obtener autorización', error);
    return res.status(500).json({ message: 'No se pudo obtener el estado de la autorización' });
  }
}

export async function aceptarAutorizacionController(req: Request, res: Response) {
  try {
    await assertEsAdministrador(req);

    const empresaId = getEmpresaId(req);
    const usuarioId = getUserId(req);

    await registrarAceptacion(empresaId, usuarioId, CFDI_SAT_AUTORIZACION_VERSION);
    await registrarBitacora({ empresaId, usuarioId, accion: 'autorizacion_aceptada' });

    const row = await obtenerAutorizacionVigente(empresaId, CFDI_SAT_AUTORIZACION_VERSION);
    return res.status(201).json(toPublicAutorizacion(row));
  } catch (error: any) {
    if (error instanceof CfdiSatPermisoError) {
      return res.status(403).json({ message: error.message });
    }

    console.error('[CFDI SAT] Error al aceptar autorización', error);
    return res.status(500).json({ message: 'No se pudo registrar la aceptación' });
  }
}
