import type { Request, Response } from 'express';
import {
  actualizarAutomatizacion,
  obtenerAutomatizacion,
} from './cfdi-sat-automatizacion.repository';
import { ejecutarAutomatizacionAsistida } from './cfdi-sat-automatizacion.service';
import {
  assertEsAdministrador,
  CfdiSatPermisoError,
  CfdiSatValidacionError,
  getEmpresaId,
  getUserId,
} from './cfdi-sat.shared';
import { SatClientError } from './sat-client';

const FRECUENCIA_MIN = 15;
const FRECUENCIA_MAX = 1440;

export async function obtenerAutomatizacionController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const config = await obtenerAutomatizacion(empresaId);
    return res.json(config);
  } catch (error) {
    console.error('[CFDI SAT] Error al obtener configuración de automatización', error);
    return res.status(500).json({ message: 'No se pudo obtener la configuración de automatización' });
  }
}

export async function actualizarAutomatizacionController(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  const usuarioId = getUserId(req);

  try {
    await assertEsAdministrador(req);

    const autoVerificar = Boolean(req.body?.auto_verificar);
    const autoDescargar = Boolean(req.body?.auto_descargar);
    const frecuenciaRaw = req.body?.frecuencia_minutos;
    const frecuenciaMinutos = Number(frecuenciaRaw);

    if (!Number.isInteger(frecuenciaMinutos) || frecuenciaMinutos < FRECUENCIA_MIN || frecuenciaMinutos > FRECUENCIA_MAX) {
      return res.status(400).json({
        message: `frecuencia_minutos debe ser un entero entre ${FRECUENCIA_MIN} y ${FRECUENCIA_MAX}`,
      });
    }

    const config = await actualizarAutomatizacion(empresaId, {
      autoVerificar,
      autoDescargar,
      frecuenciaMinutos,
      usuarioId,
    });

    return res.json(config);
  } catch (error: any) {
    if (error instanceof CfdiSatPermisoError) {
      return res.status(403).json({ message: error.message });
    }

    console.error('[CFDI SAT] Error al actualizar configuración de automatización', { empresaId, message: error?.message });
    return res.status(500).json({ message: 'No se pudo actualizar la configuración de automatización' });
  }
}

export async function ejecutarAutomatizacionController(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  const usuarioId = getUserId(req);

  try {
    await assertEsAdministrador(req);

    const fielPassword = String(req.body?.fielPassword ?? '');
    if (!fielPassword) {
      return res.status(400).json({ message: 'fielPassword es obligatorio' });
    }

    const resultado = await ejecutarAutomatizacionAsistida({ empresaId, usuarioId, fielPassword });
    return res.json(resultado);
  } catch (error: any) {
    if (error instanceof CfdiSatPermisoError) {
      return res.status(403).json({ message: error.message });
    }
    if (error instanceof CfdiSatValidacionError) {
      return res.status(error.status).json({ message: error.message });
    }
    if (error instanceof SatClientError) {
      return res.status(422).json({ message: error.message });
    }

    console.error('[CFDI SAT] Error al ejecutar automatización asistida', { empresaId, message: error?.message });
    return res.status(500).json({ message: 'No se pudo ejecutar la automatización' });
  }
}
