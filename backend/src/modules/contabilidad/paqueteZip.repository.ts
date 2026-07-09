import JSZip from 'jszip';
import { createHash } from 'crypto';
import pool from '../../config/database';
import { registrarPaqueteGenerado } from './bitacoraPaquetes.repository';
import { construirCatalogoCuentasXml } from './catalogoCuentasXml.repository';
import { construirCatalogoCuentasXmlString } from './catalogoCuentasXml.builder';
import { nombreArchivoCatalogo } from './catalogoCuentasXml.controller';
import { construirBalanzaComprobacionXml } from './balanzaComprobacionXml.repository';
import { construirBalanzaComprobacionXmlString } from './balanzaComprobacionXml.builder';
import { nombreArchivoBalanza } from './balanzaComprobacionXml.controller';
import { construirPolizasPeriodoXml } from './polizasPeriodoXml.repository';
import { construirPolizasPeriodoXmlString } from './polizasPeriodoXml.builder';
import { nombreArchivoPolizas } from './polizasPeriodoXml.controller';
import { construirAuxiliarFoliosXml } from './auxiliarFoliosXml.repository';
import { construirAuxiliarFoliosXmlString } from './auxiliarFoliosXml.builder';
import { nombreArchivoAuxiliarFolios } from './auxiliarFoliosXml.controller';
import { construirAuxiliarCuentasXml } from './auxiliarCuentasXml.repository';
import { construirAuxiliarCuentasXmlString } from './auxiliarCuentasXml.builder';
import { nombreArchivoAuxiliarCuentas } from './auxiliarCuentasXml.controller';
import { TipoEnvioBalanza } from './tipoEnvioBalanzaSat';
import { TipoSolicitudPolizas } from './tipoSolicitudSat';

// ---------------------------------------------------------------------------
// Fase 11 de Contabilidad Electrónica: paquete ZIP que agrupa los XML ya
// implementados en las Fases 6-10 (Catálogo, Balanza, Pólizas, Auxiliar de
// folios, Auxiliar de cuentas). Esta capa NO reimplementa ninguna
// validación ni builder: llama directamente a las funciones internas ya
// existentes de cada fase (construir*Xml + construir*XmlString +
// nombreArchivo*), sin HTTP interno, tal como pide el pedido ("llamar
// funciones internas comunes en lugar de hacer HTTP interno"). Este archivo
// es exclusivamente el orquestador + el empaquetado ZIP con jszip.
// ---------------------------------------------------------------------------

export type ClaveArchivoPaquete = 'catalogo' | 'balanza' | 'polizas' | 'aux_folios' | 'aux_cuentas';

// Superset estructural de los distintos tipos Error*/Advertencia* de cada
// fase ({tipo,cuenta?,descripcion?,motivo} / {tipo,poliza?,cuenta?,
// descripcion?,motivo}): todos son estructuralmente asignables aquí sin
// necesidad de mapear/convertir.
export interface DetalleProblemaArchivo {
  tipo: string;
  poliza?: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface ArchivoPaqueteZip {
  clave: ClaveArchivoPaquete;
  titulo: string;
  nombre: string;
  ok: boolean;
  errores: number;
  advertencias: number;
  detalle_errores: DetalleProblemaArchivo[];
  detalle_advertencias: DetalleProblemaArchivo[];
}

export interface PaqueteZipPreviewResultado {
  ok: boolean;
  empresa: { rfc: string; razon_social: string };
  ejercicio: number;
  periodo: number;
  resumen: {
    archivos_seleccionados: number;
    archivos_ok: number;
    archivos_con_error: number;
    errores: number;
    advertencias: number;
  };
  archivos: ArchivoPaqueteZip[];
}

export interface ParametrosPaqueteZip {
  ejercicio: number;
  periodo: number;
  incluirCatalogo: boolean;
  incluirBalanza: boolean;
  incluirPolizas: boolean;
  incluirAuxFolios: boolean;
  incluirAuxCuentas: boolean;
  tipoEnvioBalanza: TipoEnvioBalanza;
  fechaModificacionBalanza: string | null;
  tipoSolicitud: TipoSolicitudPolizas | null;
  numOrden: string | null;
  numTramite: string | null;
}

// Un archivo "construido" incluye, además de lo que va al preview, un
// generador perezoso del XML final: solo se invoca en la descarga, y solo
// si el archivo resultó ok (nunca se llama sobre un archivo con errores).
interface ArchivoConstruido extends ArchivoPaqueteZip {
  generarXml: () => string;
}

async function obtenerEmpresa(empresaId: number): Promise<{ rfc: string; razon_social: string }> {
  const { rows } = await pool.query<{ rfc: string | null; razon_social: string | null }>(
    `SELECT rfc, razon_social FROM core.empresas WHERE id = $1`,
    [empresaId]
  );
  const row = rows[0];
  return { rfc: row?.rfc?.trim() ?? '', razon_social: row?.razon_social?.trim() ?? '' };
}

async function construirArchivosSeleccionados(empresaId: number, params: ParametrosPaqueteZip): Promise<ArchivoConstruido[]> {
  const archivos: ArchivoConstruido[] = [];
  const { ejercicio, periodo } = params;

  if (params.incluirCatalogo) {
    const r = await construirCatalogoCuentasXml(empresaId, ejercicio, periodo);
    archivos.push({
      clave: 'catalogo',
      titulo: 'Catálogo de cuentas',
      nombre: nombreArchivoCatalogo(r.empresa.rfc, ejercicio, periodo),
      ok: r.ok,
      errores: r.errores.length,
      advertencias: r.advertencias.length,
      detalle_errores: r.errores,
      detalle_advertencias: r.advertencias,
      generarXml: () => construirCatalogoCuentasXmlString({ rfc: r.empresa.rfc, ejercicio: r.ejercicio, periodo: r.periodo, cuentas: r.cuentas }),
    });
  }

  if (params.incluirBalanza) {
    const r = await construirBalanzaComprobacionXml(empresaId, ejercicio, periodo, params.tipoEnvioBalanza, params.fechaModificacionBalanza);
    archivos.push({
      clave: 'balanza',
      titulo: 'Balanza de comprobación',
      nombre: nombreArchivoBalanza(r.empresa.rfc, ejercicio, periodo, r.tipo_envio),
      ok: r.ok,
      errores: r.errores.length,
      advertencias: r.advertencias.length,
      detalle_errores: r.errores,
      detalle_advertencias: r.advertencias,
      generarXml: () =>
        construirBalanzaComprobacionXmlString({
          rfc: r.empresa.rfc,
          ejercicio: r.ejercicio,
          periodo: r.periodo,
          tipoEnvio: r.tipo_envio,
          fechaModificacion: r.fecha_modificacion,
          cuentas: r.cuentas,
        }),
    });
  }

  // TipoSolicitud es requerido y compartido por Pólizas/Auxiliar de
  // folios/Auxiliar de cuentas (mismo criterio validado en la Fase 9/10):
  // si ninguno de los tres está incluido, nunca se usa.
  const tipoSolicitud = params.tipoSolicitud;
  if ((params.incluirPolizas || params.incluirAuxFolios || params.incluirAuxCuentas) && tipoSolicitud) {
    if (params.incluirPolizas) {
      const r = await construirPolizasPeriodoXml(empresaId, ejercicio, periodo, tipoSolicitud, params.numOrden, params.numTramite);
      archivos.push({
        clave: 'polizas',
        titulo: 'Pólizas del periodo',
        nombre: nombreArchivoPolizas(r.empresa.rfc, ejercicio, periodo),
        ok: r.ok,
        errores: r.errores.length,
        advertencias: r.advertencias.length,
        detalle_errores: r.errores,
        detalle_advertencias: r.advertencias,
        generarXml: () =>
          construirPolizasPeriodoXmlString({
            rfc: r.empresa.rfc,
            ejercicio: r.ejercicio,
            periodo: r.periodo,
            tipoSolicitud: r.tipo_solicitud,
            numOrden: r.num_orden,
            numTramite: r.num_tramite,
            polizas: r.polizas,
          }),
      });
    }

    if (params.incluirAuxFolios) {
      const r = await construirAuxiliarFoliosXml(empresaId, ejercicio, periodo, tipoSolicitud, params.numOrden, params.numTramite);
      archivos.push({
        clave: 'aux_folios',
        titulo: 'Auxiliar de folios fiscales',
        nombre: nombreArchivoAuxiliarFolios(r.empresa.rfc, ejercicio, periodo),
        ok: r.ok,
        errores: r.errores.length,
        advertencias: r.advertencias.length,
        detalle_errores: r.errores,
        detalle_advertencias: r.advertencias,
        generarXml: () =>
          construirAuxiliarFoliosXmlString({
            rfc: r.empresa.rfc,
            ejercicio: r.ejercicio,
            periodo: r.periodo,
            tipoSolicitud: r.tipo_solicitud,
            numOrden: r.num_orden,
            numTramite: r.num_tramite,
            folios: r.folios,
          }),
      });
    }

    if (params.incluirAuxCuentas) {
      const r = await construirAuxiliarCuentasXml(empresaId, ejercicio, periodo, tipoSolicitud, params.numOrden, params.numTramite, null);
      archivos.push({
        clave: 'aux_cuentas',
        titulo: 'Auxiliar de cuentas',
        nombre: nombreArchivoAuxiliarCuentas(r.empresa.rfc, ejercicio, periodo),
        ok: r.ok,
        errores: r.errores.length,
        advertencias: r.advertencias.length,
        detalle_errores: r.errores,
        detalle_advertencias: r.advertencias,
        generarXml: () =>
          construirAuxiliarCuentasXmlString({
            rfc: r.empresa.rfc,
            ejercicio: r.ejercicio,
            periodo: r.periodo,
            tipoSolicitud: r.tipo_solicitud,
            numOrden: r.num_orden,
            numTramite: r.num_tramite,
            cuentas: r.cuentas,
          }),
      });
    }
  }

  return archivos;
}

function resumenDe(archivos: ArchivoPaqueteZip[]): PaqueteZipPreviewResultado['resumen'] {
  const archivosOk = archivos.filter((a) => a.ok).length;
  return {
    archivos_seleccionados: archivos.length,
    archivos_ok: archivosOk,
    archivos_con_error: archivos.length - archivosOk,
    errores: archivos.reduce((acc, a) => acc + a.errores, 0),
    advertencias: archivos.reduce((acc, a) => acc + a.advertencias, 0),
  };
}

export async function construirPaqueteZipPreview(empresaId: number, params: ParametrosPaqueteZip): Promise<PaqueteZipPreviewResultado> {
  const [empresa, archivosConstruidos] = await Promise.all([
    obtenerEmpresa(empresaId),
    construirArchivosSeleccionados(empresaId, params),
  ]);

  const archivos: ArchivoPaqueteZip[] = archivosConstruidos.map(({ generarXml: _generarXml, ...resto }) => resto);

  return {
    ok: archivos.length > 0 && archivos.every((a) => a.ok),
    empresa,
    ejercicio: params.ejercicio,
    periodo: params.periodo,
    resumen: resumenDe(archivos),
    archivos,
  };
}

// Nomenclatura del ZIP (no es un archivo individual del Anexo 24, así que
// no sigue una convención SAT -- se documenta explícitamente): RFC + Año +
// Mes + "_econtabilidad.zip". Ej.: XAXX010101XXX202607_econtabilidad.zip
function nombreArchivoZip(rfc: string, ejercicio: number, periodo: number): string {
  const rfcSanitizado = rfc.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const mes = String(periodo).padStart(2, '0');
  return `${rfcSanitizado}${ejercicio}${mes}_econtabilidad.zip`;
}

export interface PaqueteZipDescargaResultado {
  ok: boolean;
  archivos: ArchivoPaqueteZip[];
  buffer: Buffer | null;
  nombreZip: string | null;
  hashZip: string | null;
}

// Fase 12: además de generar el ZIP, registra en
// contabilidad.e_contabilidad_paquetes (bitácora interna) el hash SHA-256
// del buffer, los archivos incluidos, los parámetros usados y el resumen --
// NUNCA el ZIP ni los XML binarios. Solo se registra cuando el ZIP se
// generó de verdad (ok=true); si hubo errores bloqueantes no hay buffer y
// no se escribe nada en la bitácora.
export async function construirPaqueteZipDescarga(
  empresaId: number,
  params: ParametrosPaqueteZip,
  usuarioId: number | null
): Promise<PaqueteZipDescargaResultado> {
  const [empresa, archivosConstruidos] = await Promise.all([
    obtenerEmpresa(empresaId),
    construirArchivosSeleccionados(empresaId, params),
  ]);

  const archivos: ArchivoPaqueteZip[] = archivosConstruidos.map(({ generarXml: _generarXml, ...resto }) => resto);
  const ok = archivos.length > 0 && archivos.every((a) => a.ok);
  if (!ok) {
    return { ok: false, archivos, buffer: null, nombreZip: null, hashZip: null };
  }

  const zip = new JSZip();
  for (const archivo of archivosConstruidos) {
    zip.file(archivo.nombre, archivo.generarXml());
  }
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const hashZip = createHash('sha256').update(buffer).digest('hex');
  const nombreZip = nombreArchivoZip(empresa.rfc, params.ejercicio, params.periodo);
  const resumen = resumenDe(archivos);

  await registrarPaqueteGenerado({
    empresaId,
    ejercicio: params.ejercicio,
    periodo: params.periodo,
    nombreZip,
    archivosIncluidos: archivos,
    parametros: params,
    resumen,
    hashZip,
    generadoPor: usuarioId,
  });

  return { ok: true, archivos, buffer, nombreZip, hashZip };
}
