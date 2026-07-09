import { Request, Response } from 'express';
import { construirPaqueteZipPreview, construirPaqueteZipDescarga, ParametrosPaqueteZip } from './paqueteZip.repository';
import { parseTipoEnvioBalanza } from './tipoEnvioBalanzaSat';
import { parseTipoSolicitud } from './tipoSolicitudSat';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

function getUsuarioId(req: Request): number | null {
  const id = Number(req.auth?.userId ?? 0);
  return id > 0 ? id : null;
}

function parseBooleano(valor: unknown): boolean {
  return valor === 'true' || valor === '1';
}

function parseParametrosPaquete(req: Request): ParametrosPaqueteZip | { error: string } {
  const ejercicio = Number(req.query.ejercicio);
  const periodo = Number(req.query.periodo);
  if (!Number.isInteger(ejercicio) || ejercicio <= 0) {
    return { error: 'El ejercicio es requerido y debe ser numérico.' };
  }
  if (!Number.isInteger(periodo) || periodo < 1 || periodo > 12) {
    return { error: 'El periodo es requerido y debe estar entre 1 y 12.' };
  }

  const incluirCatalogo = parseBooleano(req.query.incluir_catalogo);
  const incluirBalanza = parseBooleano(req.query.incluir_balanza);
  const incluirPolizas = parseBooleano(req.query.incluir_polizas);
  const incluirAuxFolios = parseBooleano(req.query.incluir_aux_folios);
  const incluirAuxCuentas = parseBooleano(req.query.incluir_aux_cuentas);

  if (!incluirCatalogo && !incluirBalanza && !incluirPolizas && !incluirAuxFolios && !incluirAuxCuentas) {
    return { error: 'Debe seleccionar al menos un archivo para incluir en el paquete.' };
  }

  let tipoEnvioBalanza: ParametrosPaqueteZip['tipoEnvioBalanza'] = 'N';
  let fechaModificacionBalanza: string | null = null;
  if (incluirBalanza) {
    const params = parseTipoEnvioBalanza(req);
    if ('error' in params) return { error: params.error };
    tipoEnvioBalanza = params.tipoEnvio;
    fechaModificacionBalanza = params.fechaModificacion;
  }

  let tipoSolicitud: ParametrosPaqueteZip['tipoSolicitud'] = null;
  let numOrden: string | null = null;
  let numTramite: string | null = null;
  if (incluirPolizas || incluirAuxFolios || incluirAuxCuentas) {
    const params = parseTipoSolicitud(req);
    if ('error' in params) return { error: params.error };
    tipoSolicitud = params.tipoSolicitud;
    numOrden = params.numOrden;
    numTramite = params.numTramite;
  }

  return {
    ejercicio,
    periodo,
    incluirCatalogo,
    incluirBalanza,
    incluirPolizas,
    incluirAuxFolios,
    incluirAuxCuentas,
    tipoEnvioBalanza,
    fechaModificacionBalanza,
    tipoSolicitud,
    numOrden,
    numTramite,
  };
}

export async function getPaqueteZipPreview(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const params = parseParametrosPaquete(req);
    if ('error' in params) return res.status(400).json({ message: params.error });

    const resultado = await construirPaqueteZipPreview(empresaId, params);
    return res.json(resultado);
  } catch (error) {
    console.error('Error al previsualizar el paquete ZIP de contabilidad electrónica', error);
    return res.status(500).json({ message: 'No se pudo previsualizar el paquete de contabilidad electrónica' });
  }
}

export async function getPaqueteZipDescargar(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const params = parseParametrosPaquete(req);
    if ('error' in params) return res.status(400).json({ message: params.error });

    const resultado = await construirPaqueteZipDescarga(empresaId, params, getUsuarioId(req));
    if (!resultado.ok || !resultado.buffer || !resultado.nombreZip) {
      return res.status(400).json({
        message: 'Uno o más archivos seleccionados tienen errores que deben corregirse antes de generar el ZIP.',
        archivos: resultado.archivos,
      });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${resultado.nombreZip}"`);
    return res.send(resultado.buffer);
  } catch (error) {
    console.error('Error al generar el paquete ZIP de contabilidad electrónica', error);
    return res.status(500).json({ message: 'No se pudo generar el paquete de contabilidad electrónica' });
  }
}
