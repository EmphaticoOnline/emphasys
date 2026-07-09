import { Request, Response } from 'express';
import { construirAuxiliarCuentasXml } from './auxiliarCuentasXml.repository';
import { construirAuxiliarCuentasXmlString } from './auxiliarCuentasXml.builder';
import { parseTipoSolicitud } from './tipoSolicitudSat';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

function parseParametros(req: Request): { ejercicio: number; periodo: number; cuentaId: number | null } | { error: string } {
  const ejercicio = Number(req.query.ejercicio);
  const periodo = Number(req.query.periodo);
  if (!Number.isInteger(ejercicio) || ejercicio <= 0) {
    return { error: 'El ejercicio es requerido y debe ser numérico.' };
  }
  if (!Number.isInteger(periodo) || periodo < 1 || periodo > 12) {
    return { error: 'El periodo es requerido y debe estar entre 1 y 12.' };
  }
  const cuentaIdRaw = req.query.cuenta_id as string | undefined;
  let cuentaId: number | null = null;
  if (cuentaIdRaw != null && cuentaIdRaw.trim() !== '') {
    const parsed = Number(cuentaIdRaw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { error: 'El identificador de cuenta no es válido.' };
    }
    cuentaId = parsed;
  }
  return { ejercicio, periodo, cuentaId };
}

export async function getAuxiliarCuentasPreview(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const params = parseParametros(req);
    if ('error' in params) return res.status(400).json({ message: params.error });

    const tipoSolicitudParams = parseTipoSolicitud(req);
    if ('error' in tipoSolicitudParams) return res.status(400).json({ message: tipoSolicitudParams.error });

    const resultado = await construirAuxiliarCuentasXml(
      empresaId,
      params.ejercicio,
      params.periodo,
      tipoSolicitudParams.tipoSolicitud,
      tipoSolicitudParams.numOrden,
      tipoSolicitudParams.numTramite,
      params.cuentaId
    );
    return res.json(resultado);
  } catch (error) {
    console.error('Error al previsualizar el auxiliar de cuentas', error);
    return res.status(500).json({ message: 'No se pudo previsualizar el auxiliar de cuentas' });
  }
}

// Nomenclatura oficial SAT para el archivo de auxiliar de cuentas:
// RFC + Año (4 dígitos) + Mes (2 dígitos) + "XC" + .xml
// Ej.: RFC XAXX010101XXX, julio 2026 -> XAXX010101XXX202607XC.xml
export function nombreArchivoAuxiliarCuentas(rfc: string, ejercicio: number, periodo: number): string {
  const rfcSanitizado = rfc.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const mes = String(periodo).padStart(2, '0');
  return `${rfcSanitizado}${ejercicio}${mes}XC.xml`;
}

export async function getAuxiliarCuentasDescargar(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const params = parseParametros(req);
    if ('error' in params) return res.status(400).json({ message: params.error });

    const tipoSolicitudParams = parseTipoSolicitud(req);
    if ('error' in tipoSolicitudParams) return res.status(400).json({ message: tipoSolicitudParams.error });

    const resultado = await construirAuxiliarCuentasXml(
      empresaId,
      params.ejercicio,
      params.periodo,
      tipoSolicitudParams.tipoSolicitud,
      tipoSolicitudParams.numOrden,
      tipoSolicitudParams.numTramite,
      params.cuentaId
    );
    if (!resultado.ok) {
      return res.status(400).json({
        message: 'El auxiliar de cuentas tiene errores que deben corregirse antes de generar el XML.',
        errores: resultado.errores,
      });
    }

    const xml = construirAuxiliarCuentasXmlString({
      rfc: resultado.empresa.rfc,
      ejercicio: resultado.ejercicio,
      periodo: resultado.periodo,
      tipoSolicitud: resultado.tipo_solicitud,
      numOrden: resultado.num_orden,
      numTramite: resultado.num_tramite,
      cuentas: resultado.cuentas,
    });

    const nombreArchivo = nombreArchivoAuxiliarCuentas(resultado.empresa.rfc, resultado.ejercicio, resultado.periodo);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    return res.send(xml);
  } catch (error) {
    console.error('Error al generar el XML del auxiliar de cuentas', error);
    return res.status(500).json({ message: 'No se pudo generar el XML del auxiliar de cuentas' });
  }
}
