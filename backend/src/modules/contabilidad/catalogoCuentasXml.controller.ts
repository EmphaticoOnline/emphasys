import { Request, Response } from 'express';
import { construirCatalogoCuentasXml } from './catalogoCuentasXml.repository';
import { construirCatalogoCuentasXmlString } from './catalogoCuentasXml.builder';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

function parseEjercicioPeriodo(req: Request): { ejercicio: number; periodo: number } | null {
  const ejercicio = Number(req.query.ejercicio);
  const periodo = Number(req.query.periodo);
  if (!Number.isInteger(ejercicio) || ejercicio <= 0) return null;
  if (!Number.isInteger(periodo) || periodo < 1 || periodo > 12) return null;
  return { ejercicio, periodo };
}

export async function getCatalogoXmlPreview(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const params = parseEjercicioPeriodo(req);
    if (!params) {
      return res.status(400).json({ message: 'Ejercicio y periodo son requeridos y deben ser válidos (periodo entre 1 y 12)' });
    }

    const resultado = await construirCatalogoCuentasXml(empresaId, params.ejercicio, params.periodo);
    return res.json(resultado);
  } catch (error) {
    console.error('Error al previsualizar el catálogo de cuentas XML', error);
    return res.status(500).json({ message: 'No se pudo previsualizar el catálogo de cuentas' });
  }
}

// Nomenclatura oficial SAT para el archivo de catálogo de cuentas:
// RFC + Año (4 dígitos) + Mes (2 dígitos) + "CT" + .xml
// Ej.: para RFC XAXX010101XXX, julio de 2026 -> XAXX010101XXX202607CT.xml
export function nombreArchivoCatalogo(rfc: string, ejercicio: number, periodo: number): string {
  const rfcSanitizado = rfc.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const mes = String(periodo).padStart(2, '0');
  return `${rfcSanitizado}${ejercicio}${mes}CT.xml`;
}

export async function getCatalogoXmlDescargar(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const params = parseEjercicioPeriodo(req);
    if (!params) {
      return res.status(400).json({ message: 'Ejercicio y periodo son requeridos y deben ser válidos (periodo entre 1 y 12)' });
    }

    // Se corren las mismas validaciones que en el preview: si hay errores
    // bloqueantes, no se genera el XML.
    const resultado = await construirCatalogoCuentasXml(empresaId, params.ejercicio, params.periodo);
    if (!resultado.ok) {
      return res.status(400).json({
        message: 'El catálogo de cuentas tiene errores que deben corregirse antes de generar el XML.',
        errores: resultado.errores,
      });
    }

    const xml = construirCatalogoCuentasXmlString({
      rfc: resultado.empresa.rfc,
      ejercicio: resultado.ejercicio,
      periodo: resultado.periodo,
      cuentas: resultado.cuentas,
    });

    const nombreArchivo = nombreArchivoCatalogo(resultado.empresa.rfc, resultado.ejercicio, resultado.periodo);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    return res.send(xml);
  } catch (error) {
    console.error('Error al generar el XML del catálogo de cuentas', error);
    return res.status(500).json({ message: 'No se pudo generar el XML del catálogo de cuentas' });
  }
}
