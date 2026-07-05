import type { Request, Response } from 'express';
import { obtenerResumenModulo } from './cfdi-sat-resumen.repository';
import { medirUsoAlmacenamientoEmpresa } from './cfdi-sat-storage';
import { obtenerEmpresaPorId } from '../../../services/empresasService';
import { getEmpresaId } from './cfdi-sat.shared';

export async function obtenerResumenModuloController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const resumen = await obtenerResumenModulo(empresaId);
    return res.json(resumen);
  } catch (error) {
    console.error('[CFDI SAT] Error al obtener resumen del módulo', error);
    return res.status(500).json({ message: 'No se pudo obtener el resumen del módulo' });
  }
}

/**
 * Conteo de archivos y tamaño aproximado en storage privado, acotado a la
 * empresa activa. Nunca devuelve rutas: solo cifras, para poder evaluar una
 * futura política de retención sin exponer el filesystem.
 */
export async function obtenerAlmacenamientoController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const empresa = await obtenerEmpresaPorId(empresaId);
    if (!empresa) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    const uso = await medirUsoAlmacenamientoEmpresa(empresa.identificador);

    return res.json({
      zips: uso.zips,
      xml: uso.xmls,
      total_bytes: uso.zips.bytes + uso.xmls.bytes,
      total_archivos: uso.zips.archivos + uso.xmls.archivos,
    });
  } catch (error) {
    console.error('[CFDI SAT] Error al calcular uso de almacenamiento', error);
    return res.status(500).json({ message: 'No se pudo calcular el uso de almacenamiento' });
  }
}
