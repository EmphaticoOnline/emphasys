import { Request, Response } from 'express';
import { construirBalanzaComprobacionXml } from './balanzaComprobacionXml.repository';
import { construirBalanzaComprobacionXmlString } from './balanzaComprobacionXml.builder';
import { parseTipoEnvioBalanza, TipoEnvioBalanza } from './tipoEnvioBalanzaSat';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

interface ParametrosBalanza {
  ejercicio: number;
  periodo: number;
  tipoEnvio: TipoEnvioBalanza;
  fechaModificacion: string | null;
}

// Igual que en catalogoCuentasXml.controller.ts: los parámetros malformados
// (ejercicio/periodo/tipo_envio inválidos, o complementaria sin fecha) se
// tratan como error de request (400 con mensaje), no como filas del arreglo
// `errores` del resultado — son validaciones 3/4/5/6 del pedido, pero de
// forma/parámetro, no de contenido contable. TipoEnvio/FechaModBal se
// comparte con Paquete ZIP (Fase 11) vía tipoEnvioBalanzaSat.ts.
function parseParametrosBalanza(req: Request): ParametrosBalanza | { error: string } {
  const ejercicio = Number(req.query.ejercicio);
  const periodo = Number(req.query.periodo);
  if (!Number.isInteger(ejercicio) || ejercicio <= 0) {
    return { error: 'El ejercicio es requerido y debe ser numérico.' };
  }
  if (!Number.isInteger(periodo) || periodo < 1 || periodo > 12) {
    return { error: 'El periodo es requerido y debe estar entre 1 y 12.' };
  }

  const tipoEnvioParams = parseTipoEnvioBalanza(req);
  if ('error' in tipoEnvioParams) return tipoEnvioParams;

  return { ejercicio, periodo, ...tipoEnvioParams };
}

export async function getBalanzaXmlPreview(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const params = parseParametrosBalanza(req);
    if ('error' in params) {
      return res.status(400).json({ message: params.error });
    }

    const resultado = await construirBalanzaComprobacionXml(
      empresaId,
      params.ejercicio,
      params.periodo,
      params.tipoEnvio,
      params.fechaModificacion
    );
    return res.json(resultado);
  } catch (error) {
    console.error('Error al previsualizar la balanza de comprobación XML', error);
    return res.status(500).json({ message: 'No se pudo previsualizar la balanza de comprobación' });
  }
}

// Nomenclatura oficial SAT para el archivo de balanza de comprobación:
// RFC + Año (4 dígitos) + Mes (2 dígitos) + "BN" (Normal) o "BC"
// (Complementaria) + .xml
// Ej.: RFC XAXX010101XXX, julio 2026, normal -> XAXX010101XXX202607BN.xml
export function nombreArchivoBalanza(rfc: string, ejercicio: number, periodo: number, tipoEnvio: TipoEnvioBalanza): string {
  const rfcSanitizado = rfc.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const mes = String(periodo).padStart(2, '0');
  const sufijo = tipoEnvio === 'C' ? 'BC' : 'BN';
  return `${rfcSanitizado}${ejercicio}${mes}${sufijo}.xml`;
}

export async function getBalanzaXmlDescargar(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const params = parseParametrosBalanza(req);
    if ('error' in params) {
      return res.status(400).json({ message: params.error });
    }

    // Mismas validaciones que en el preview: si hay errores bloqueantes, no
    // se genera el XML.
    const resultado = await construirBalanzaComprobacionXml(
      empresaId,
      params.ejercicio,
      params.periodo,
      params.tipoEnvio,
      params.fechaModificacion
    );
    if (!resultado.ok) {
      return res.status(400).json({
        message: 'La balanza de comprobación tiene errores que deben corregirse antes de generar el XML.',
        errores: resultado.errores,
      });
    }

    const xml = construirBalanzaComprobacionXmlString({
      rfc: resultado.empresa.rfc,
      ejercicio: resultado.ejercicio,
      periodo: resultado.periodo,
      tipoEnvio: resultado.tipo_envio,
      fechaModificacion: resultado.fecha_modificacion,
      cuentas: resultado.cuentas,
    });

    const nombreArchivo = nombreArchivoBalanza(resultado.empresa.rfc, resultado.ejercicio, resultado.periodo, resultado.tipo_envio);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    return res.send(xml);
  } catch (error) {
    console.error('Error al generar el XML de la balanza de comprobación', error);
    return res.status(500).json({ message: 'No se pudo generar el XML de la balanza de comprobación' });
  }
}
