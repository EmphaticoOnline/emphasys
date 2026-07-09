import { Request, Response } from 'express';
import { construirPolizasPeriodoXml } from './polizasPeriodoXml.repository';
import { construirPolizasPeriodoXmlString } from './polizasPeriodoXml.builder';
import { parseTipoSolicitud, TipoSolicitudPolizas } from './tipoSolicitudSat';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

interface ParametrosPolizasXml {
  ejercicio: number;
  periodo: number;
  tipoSolicitud: TipoSolicitudPolizas;
  numOrden: string | null;
  numTramite: string | null;
}

// Igual que en balanzaComprobacionXml.controller.ts: los parámetros
// malformados (ejercicio/periodo/tipo_solicitud inválidos, o NumOrden/
// NumTramite faltante o con formato incorrecto cuando el tipo de solicitud
// lo exige) se tratan como error de request (400), no como filas del
// arreglo `errores` del resultado — son las validaciones 3/4/5/6/7 del
// pedido, pero de forma/parámetro, no de contenido contable. La parte de
// TipoSolicitud/NumOrden/NumTramite se comparte con Auxiliar de folios y
// Auxiliar de cuentas (Fase 10) vía tipoSolicitudSat.ts.
function parseParametrosPolizasXml(req: Request): ParametrosPolizasXml | { error: string } {
  const ejercicio = Number(req.query.ejercicio);
  const periodo = Number(req.query.periodo);
  if (!Number.isInteger(ejercicio) || ejercicio <= 0) {
    return { error: 'El ejercicio es requerido y debe ser numérico.' };
  }
  if (!Number.isInteger(periodo) || periodo < 1 || periodo > 12) {
    return { error: 'El periodo es requerido y debe estar entre 1 y 12.' };
  }

  const tipoSolicitudParams = parseTipoSolicitud(req);
  if ('error' in tipoSolicitudParams) return tipoSolicitudParams;

  return { ejercicio, periodo, ...tipoSolicitudParams };
}

export async function getPolizasXmlPreview(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const params = parseParametrosPolizasXml(req);
    if ('error' in params) {
      return res.status(400).json({ message: params.error });
    }

    const resultado = await construirPolizasPeriodoXml(
      empresaId,
      params.ejercicio,
      params.periodo,
      params.tipoSolicitud,
      params.numOrden,
      params.numTramite
    );
    return res.json(resultado);
  } catch (error) {
    console.error('Error al previsualizar las pólizas del periodo XML', error);
    return res.status(500).json({ message: 'No se pudieron previsualizar las pólizas del periodo' });
  }
}

// Nomenclatura oficial SAT para el archivo de pólizas del periodo:
// RFC + Año (4 dígitos) + Mes (2 dígitos) + "PL" + .xml
// Ej.: RFC XAXX010101XXX, julio 2026 -> XAXX010101XXX202607PL.xml
export function nombreArchivoPolizas(rfc: string, ejercicio: number, periodo: number): string {
  const rfcSanitizado = rfc.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const mes = String(periodo).padStart(2, '0');
  return `${rfcSanitizado}${ejercicio}${mes}PL.xml`;
}

export async function getPolizasXmlDescargar(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const params = parseParametrosPolizasXml(req);
    if ('error' in params) {
      return res.status(400).json({ message: params.error });
    }

    const resultado = await construirPolizasPeriodoXml(
      empresaId,
      params.ejercicio,
      params.periodo,
      params.tipoSolicitud,
      params.numOrden,
      params.numTramite
    );
    if (!resultado.ok) {
      return res.status(400).json({
        message: 'Las pólizas del periodo tienen errores que deben corregirse antes de generar el XML.',
        errores: resultado.errores,
      });
    }

    const xml = construirPolizasPeriodoXmlString({
      rfc: resultado.empresa.rfc,
      ejercicio: resultado.ejercicio,
      periodo: resultado.periodo,
      tipoSolicitud: resultado.tipo_solicitud,
      numOrden: resultado.num_orden,
      numTramite: resultado.num_tramite,
      polizas: resultado.polizas,
    });

    const nombreArchivo = nombreArchivoPolizas(resultado.empresa.rfc, resultado.ejercicio, resultado.periodo);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    return res.send(xml);
  } catch (error) {
    console.error('Error al generar el XML de pólizas del periodo', error);
    return res.status(500).json({ message: 'No se pudo generar el XML de pólizas del periodo' });
  }
}
