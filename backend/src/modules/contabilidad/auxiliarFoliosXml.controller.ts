import { Request, Response } from 'express';
import { construirAuxiliarFoliosXml } from './auxiliarFoliosXml.repository';
import { construirAuxiliarFoliosXmlString } from './auxiliarFoliosXml.builder';
import { parseTipoSolicitud } from './tipoSolicitudSat';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

function parseEjercicioPeriodo(req: Request): { ejercicio: number; periodo: number } | { error: string } {
  const ejercicio = Number(req.query.ejercicio);
  const periodo = Number(req.query.periodo);
  if (!Number.isInteger(ejercicio) || ejercicio <= 0) {
    return { error: 'El ejercicio es requerido y debe ser numérico.' };
  }
  if (!Number.isInteger(periodo) || periodo < 1 || periodo > 12) {
    return { error: 'El periodo es requerido y debe estar entre 1 y 12.' };
  }
  return { ejercicio, periodo };
}

export async function getAuxiliarFoliosPreview(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const periodoParams = parseEjercicioPeriodo(req);
    if ('error' in periodoParams) return res.status(400).json({ message: periodoParams.error });

    const tipoSolicitudParams = parseTipoSolicitud(req);
    if ('error' in tipoSolicitudParams) return res.status(400).json({ message: tipoSolicitudParams.error });

    const resultado = await construirAuxiliarFoliosXml(
      empresaId,
      periodoParams.ejercicio,
      periodoParams.periodo,
      tipoSolicitudParams.tipoSolicitud,
      tipoSolicitudParams.numOrden,
      tipoSolicitudParams.numTramite
    );
    return res.json(resultado);
  } catch (error) {
    console.error('Error al previsualizar el auxiliar de folios fiscales', error);
    return res.status(500).json({ message: 'No se pudo previsualizar el auxiliar de folios fiscales' });
  }
}

// Nomenclatura oficial SAT para el archivo de auxiliar de folios:
// RFC + Año (4 dígitos) + Mes (2 dígitos) + "XF" + .xml
// Ej.: RFC XAXX010101XXX, julio 2026 -> XAXX010101XXX202607XF.xml
export function nombreArchivoAuxiliarFolios(rfc: string, ejercicio: number, periodo: number): string {
  const rfcSanitizado = rfc.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const mes = String(periodo).padStart(2, '0');
  return `${rfcSanitizado}${ejercicio}${mes}XF.xml`;
}

export async function getAuxiliarFoliosDescargar(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const periodoParams = parseEjercicioPeriodo(req);
    if ('error' in periodoParams) return res.status(400).json({ message: periodoParams.error });

    const tipoSolicitudParams = parseTipoSolicitud(req);
    if ('error' in tipoSolicitudParams) return res.status(400).json({ message: tipoSolicitudParams.error });

    const resultado = await construirAuxiliarFoliosXml(
      empresaId,
      periodoParams.ejercicio,
      periodoParams.periodo,
      tipoSolicitudParams.tipoSolicitud,
      tipoSolicitudParams.numOrden,
      tipoSolicitudParams.numTramite
    );
    if (!resultado.ok) {
      return res.status(400).json({
        message: 'El auxiliar de folios fiscales tiene errores que deben corregirse antes de generar el XML.',
        errores: resultado.errores,
      });
    }

    const xml = construirAuxiliarFoliosXmlString({
      rfc: resultado.empresa.rfc,
      ejercicio: resultado.ejercicio,
      periodo: resultado.periodo,
      tipoSolicitud: resultado.tipo_solicitud,
      numOrden: resultado.num_orden,
      numTramite: resultado.num_tramite,
      folios: resultado.folios,
    });

    const nombreArchivo = nombreArchivoAuxiliarFolios(resultado.empresa.rfc, resultado.ejercicio, resultado.periodo);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    return res.send(xml);
  } catch (error) {
    console.error('Error al generar el XML del auxiliar de folios fiscales', error);
    return res.status(500).json({ message: 'No se pudo generar el XML del auxiliar de folios fiscales' });
  }
}
