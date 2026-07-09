import { apiFetch, apiFetchBlob, triggerBlobDownload } from './apiFetch';
import type { ValidacionEContabilidadResultado } from '../types/eContabilidad';
import type { CodigoAgrupadorSat } from '../types/codigosAgrupadores';
import type { SugerenciaCodigoAgrupador } from '../types/sugerenciasCodigosAgrupadores';
import type { CatalogoCuentasXmlResultado } from '../types/catalogoXml';
import type { BalanzaComprobacionXmlResultado, TipoEnvioBalanza } from '../types/balanzaXml';
import type { PolizasSatResultado } from '../types/polizasSat';
import type { PolizasPeriodoXmlResultado, TipoSolicitudPolizas } from '../types/polizasXml';
import type { AuxiliarFoliosResultado, AuxiliarCuentasResultado } from '../types/auxiliaresSat';
import type { PaqueteZipPreviewResultado, TipoEnvioBalanza as TipoEnvioBalanzaZip } from '../types/paqueteZip';
import type { BitacoraPaquetesResultado } from '../types/bitacora';

export async function fetchValidacionesEContabilidad(
  ejercicio: number,
  periodo: number
): Promise<ValidacionEContabilidadResultado> {
  return apiFetch(`/api/contabilidad/e-contabilidad/validaciones?ejercicio=${ejercicio}&periodo=${periodo}`);
}

export async function fetchCodigosAgrupadores(buscar?: string): Promise<CodigoAgrupadorSat[]> {
  const query = buscar?.trim() ? `?buscar=${encodeURIComponent(buscar.trim())}` : '';
  return apiFetch(`/api/contabilidad/e-contabilidad/codigos-agrupadores${query}`);
}

export async function fetchSugerenciasCodigosAgrupadores(): Promise<SugerenciaCodigoAgrupador[]> {
  return apiFetch('/api/contabilidad/e-contabilidad/sugerencias-codigos-agrupadores');
}

export async function fetchCatalogoXmlPreview(
  ejercicio: number,
  periodo: number
): Promise<CatalogoCuentasXmlResultado> {
  return apiFetch(`/api/contabilidad/e-contabilidad/catalogo-xml/preview?ejercicio=${ejercicio}&periodo=${periodo}`);
}

export async function descargarCatalogoXml(ejercicio: number, periodo: number): Promise<void> {
  const { blob, filename } = await apiFetchBlob(
    `/api/contabilidad/e-contabilidad/catalogo-xml/descargar?ejercicio=${ejercicio}&periodo=${periodo}`
  );
  triggerBlobDownload(blob, filename);
}

function construirQueryBalanza(
  ejercicio: number,
  periodo: number,
  tipoEnvio: TipoEnvioBalanza,
  fechaModificacion: string | null
): string {
  const params = new URLSearchParams({ ejercicio: String(ejercicio), periodo: String(periodo), tipo_envio: tipoEnvio });
  if (tipoEnvio === 'C' && fechaModificacion) {
    params.set('fecha_modificacion', fechaModificacion);
  }
  return params.toString();
}

export async function fetchBalanzaXmlPreview(
  ejercicio: number,
  periodo: number,
  tipoEnvio: TipoEnvioBalanza,
  fechaModificacion: string | null
): Promise<BalanzaComprobacionXmlResultado> {
  return apiFetch(
    `/api/contabilidad/e-contabilidad/balanza-xml/preview?${construirQueryBalanza(ejercicio, periodo, tipoEnvio, fechaModificacion)}`
  );
}

export async function descargarBalanzaXml(
  ejercicio: number,
  periodo: number,
  tipoEnvio: TipoEnvioBalanza,
  fechaModificacion: string | null
): Promise<void> {
  const { blob, filename } = await apiFetchBlob(
    `/api/contabilidad/e-contabilidad/balanza-xml/descargar?${construirQueryBalanza(ejercicio, periodo, tipoEnvio, fechaModificacion)}`
  );
  triggerBlobDownload(blob, filename);
}

export async function fetchPolizasSatPreview(ejercicio: number, periodo: number): Promise<PolizasSatResultado> {
  return apiFetch(`/api/contabilidad/e-contabilidad/polizas-sat/preview?ejercicio=${ejercicio}&periodo=${periodo}`);
}

function construirQueryPolizasXml(
  ejercicio: number,
  periodo: number,
  tipoSolicitud: TipoSolicitudPolizas,
  numOrden: string | null,
  numTramite: string | null
): string {
  const params = new URLSearchParams({ ejercicio: String(ejercicio), periodo: String(periodo), tipo_solicitud: tipoSolicitud });
  if ((tipoSolicitud === 'AF' || tipoSolicitud === 'FC') && numOrden) {
    params.set('num_orden', numOrden);
  }
  if ((tipoSolicitud === 'DE' || tipoSolicitud === 'CO') && numTramite) {
    params.set('num_tramite', numTramite);
  }
  return params.toString();
}

export async function fetchPolizasXmlPreview(
  ejercicio: number,
  periodo: number,
  tipoSolicitud: TipoSolicitudPolizas,
  numOrden: string | null,
  numTramite: string | null
): Promise<PolizasPeriodoXmlResultado> {
  return apiFetch(
    `/api/contabilidad/e-contabilidad/polizas-xml/preview?${construirQueryPolizasXml(ejercicio, periodo, tipoSolicitud, numOrden, numTramite)}`
  );
}

export async function descargarPolizasXml(
  ejercicio: number,
  periodo: number,
  tipoSolicitud: TipoSolicitudPolizas,
  numOrden: string | null,
  numTramite: string | null
): Promise<void> {
  const { blob, filename } = await apiFetchBlob(
    `/api/contabilidad/e-contabilidad/polizas-xml/descargar?${construirQueryPolizasXml(ejercicio, periodo, tipoSolicitud, numOrden, numTramite)}`
  );
  triggerBlobDownload(blob, filename);
}

export async function fetchAuxiliarFoliosPreview(
  ejercicio: number,
  periodo: number,
  tipoSolicitud: TipoSolicitudPolizas,
  numOrden: string | null,
  numTramite: string | null
): Promise<AuxiliarFoliosResultado> {
  return apiFetch(
    `/api/contabilidad/e-contabilidad/auxiliares-sat/folios/preview?${construirQueryPolizasXml(ejercicio, periodo, tipoSolicitud, numOrden, numTramite)}`
  );
}

export async function descargarAuxiliarFolios(
  ejercicio: number,
  periodo: number,
  tipoSolicitud: TipoSolicitudPolizas,
  numOrden: string | null,
  numTramite: string | null
): Promise<void> {
  const { blob, filename } = await apiFetchBlob(
    `/api/contabilidad/e-contabilidad/auxiliares-sat/folios/descargar?${construirQueryPolizasXml(ejercicio, periodo, tipoSolicitud, numOrden, numTramite)}`
  );
  triggerBlobDownload(blob, filename);
}

export async function fetchAuxiliarCuentasPreview(
  ejercicio: number,
  periodo: number,
  tipoSolicitud: TipoSolicitudPolizas,
  numOrden: string | null,
  numTramite: string | null
): Promise<AuxiliarCuentasResultado> {
  return apiFetch(
    `/api/contabilidad/e-contabilidad/auxiliares-sat/cuentas/preview?${construirQueryPolizasXml(ejercicio, periodo, tipoSolicitud, numOrden, numTramite)}`
  );
}

export async function descargarAuxiliarCuentas(
  ejercicio: number,
  periodo: number,
  tipoSolicitud: TipoSolicitudPolizas,
  numOrden: string | null,
  numTramite: string | null
): Promise<void> {
  const { blob, filename } = await apiFetchBlob(
    `/api/contabilidad/e-contabilidad/auxiliares-sat/cuentas/descargar?${construirQueryPolizasXml(ejercicio, periodo, tipoSolicitud, numOrden, numTramite)}`
  );
  triggerBlobDownload(blob, filename);
}

export interface ParametrosPaqueteZip {
  ejercicio: number;
  periodo: number;
  incluirCatalogo: boolean;
  incluirBalanza: boolean;
  incluirPolizas: boolean;
  incluirAuxFolios: boolean;
  incluirAuxCuentas: boolean;
  tipoEnvioBalanza: TipoEnvioBalanzaZip;
  fechaModificacionBalanza: string | null;
  tipoSolicitud: TipoSolicitudPolizas | null;
  numOrden: string | null;
  numTramite: string | null;
}

function construirQueryPaqueteZip(params: ParametrosPaqueteZip): string {
  const query = new URLSearchParams({
    ejercicio: String(params.ejercicio),
    periodo: String(params.periodo),
    incluir_catalogo: String(params.incluirCatalogo),
    incluir_balanza: String(params.incluirBalanza),
    incluir_polizas: String(params.incluirPolizas),
    incluir_aux_folios: String(params.incluirAuxFolios),
    incluir_aux_cuentas: String(params.incluirAuxCuentas),
  });
  if (params.incluirBalanza) {
    query.set('tipo_envio_balanza', params.tipoEnvioBalanza);
    if (params.tipoEnvioBalanza === 'C' && params.fechaModificacionBalanza) {
      query.set('fecha_modificacion_balanza', params.fechaModificacionBalanza);
    }
  }
  if ((params.incluirPolizas || params.incluirAuxFolios || params.incluirAuxCuentas) && params.tipoSolicitud) {
    query.set('tipo_solicitud', params.tipoSolicitud);
    if ((params.tipoSolicitud === 'AF' || params.tipoSolicitud === 'FC') && params.numOrden) {
      query.set('num_orden', params.numOrden);
    }
    if ((params.tipoSolicitud === 'DE' || params.tipoSolicitud === 'CO') && params.numTramite) {
      query.set('num_tramite', params.numTramite);
    }
  }
  return query.toString();
}

export async function fetchPaqueteZipPreview(params: ParametrosPaqueteZip): Promise<PaqueteZipPreviewResultado> {
  return apiFetch(`/api/contabilidad/e-contabilidad/paquete-zip/preview?${construirQueryPaqueteZip(params)}`);
}

export async function descargarPaqueteZip(params: ParametrosPaqueteZip): Promise<void> {
  const { blob, filename } = await apiFetchBlob(`/api/contabilidad/e-contabilidad/paquete-zip/descargar?${construirQueryPaqueteZip(params)}`);
  triggerBlobDownload(blob, filename);
}

export async function fetchBitacoraPaquetes(filtros: {
  ejercicio?: number | undefined;
  periodo?: number | undefined;
  buscar?: string | undefined;
}): Promise<BitacoraPaquetesResultado> {
  const query = new URLSearchParams();
  if (filtros.ejercicio != null) query.set('ejercicio', String(filtros.ejercicio));
  if (filtros.periodo != null) query.set('periodo', String(filtros.periodo));
  if (filtros.buscar?.trim()) query.set('buscar', filtros.buscar.trim());
  return apiFetch(`/api/contabilidad/e-contabilidad/bitacora?${query.toString()}`);
}
