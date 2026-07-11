import {
  actualizarSolicitudTrasVerificacion,
  type CfdiSatSolicitudRow,
} from './cfdi-sat-solicitudes.repository';
import {
  insertarPaquetesPendientes,
  marcarPaqueteDescargado,
  marcarPaqueteError,
  type CfdiSatPaqueteRow,
} from './cfdi-sat-paquetes.repository';
import { insertarComprobante } from './cfdi-sat-comprobantes.repository';
import { extraerComprobantesDePaquete } from './cfdi-sat-package-extractor';
import { guardarZipPrivado, guardarXmlPrivado } from './cfdi-sat-storage';
import { registrarBitacora } from './cfdi-sat-bitacora.repository';
import {
  descargarPaqueteSat,
  extraerDetalleErrorSat,
  verificarSolicitudSat,
  SatClientError,
  type SatEstatusVerificacion,
} from './sat-client';

/**
 * Lógica de negocio de verify()/download() compartida entre el flujo manual
 * (un clic por solicitud, cfdi-sat-solicitudes.controller.ts) y la ejecución
 * asistida de Fase 9 (varias solicitudes con una sola captura de contraseña,
 * cfdi-sat-automatizacion.service.ts). Cada llamador decide cómo registrar la
 * bitácora "de alto nivel" (verificacion vs verificacion_automatica, etc.).
 */

/** Trunca y evita filtrar detalles internos largos (stacks, payloads) al guardar mensajes de error. */
function sanitizarMensajeError(mensaje: unknown, fallback: string): string {
  const texto = String(mensaje ?? '').trim();
  if (!texto) return fallback;
  return texto.slice(0, 500);
}

export interface ResultadoVerificacionSolicitud {
  estatus: SatEstatusVerificacion;
  numeroCfdis: number;
  paquetesNuevos: number;
  mensajeSat: string | null;
}

/**
 * Verifica una solicitud ya aceptada por el SAT. Requiere `solicitud.sat_request_id`
 * (el llamador debe filtrar/validar esto antes de invocar). Si la llamada al SAT
 * falla, la solicitud queda marcada con estatus 'error' y se relanza el error para
 * que el llamador decida el código de respuesta / bitácora.
 */
export async function ejecutarVerificacionSolicitud(params: {
  solicitud: CfdiSatSolicitudRow;
  cerBuffer: Buffer;
  keyBuffer: Buffer;
  fielPassword: string;
}): Promise<ResultadoVerificacionSolicitud> {
  const { solicitud, cerBuffer, keyBuffer, fielPassword } = params;

  let resultado;
  try {
    resultado = await verificarSolicitudSat({
      cerBuffer,
      keyBuffer,
      fielPassword,
      satRequestId: solicitud.sat_request_id as string,
    });
  } catch (error: any) {
    const mensaje =
      error instanceof SatClientError ? error.message : 'No se pudo verificar la solicitud ante el SAT';

    await actualizarSolicitudTrasVerificacion(solicitud.id, {
      estatus: 'error',
      cfdisEncontrados: solicitud.cfdis_encontrados ?? 0,
      mensajeError: mensaje,
    });

    throw error instanceof SatClientError ? error : new SatClientError(mensaje);
  }

  const esProblema =
    resultado.estatus === 'error' || resultado.estatus === 'rechazado' || resultado.estatus === 'expirado';

  await actualizarSolicitudTrasVerificacion(solicitud.id, {
    estatus: resultado.estatus,
    cfdisEncontrados: resultado.numeroCfdis,
    mensajeError: esProblema ? resultado.mensaje : null,
  });

  let paquetesNuevos = 0;
  if (resultado.packageIds.length > 0) {
    await insertarPaquetesPendientes(solicitud.id, resultado.packageIds);
    paquetesNuevos = resultado.packageIds.length;
  }

  return {
    estatus: resultado.estatus,
    numeroCfdis: resultado.numeroCfdis,
    paquetesNuevos,
    mensajeSat: resultado.mensaje,
  };
}

export interface ResultadoDescargaSolicitud {
  nuevos: number;
  duplicados: number;
  paquetesConError: number;
  erroresParseo: number;
}

/**
 * Descarga los paquetes indicados (ya filtrados por el llamador con
 * listarPaquetesPendientesOError) de una solicitud, extrae sus comprobantes y
 * los registra. Los errores por paquete/comprobante no abortan el resto: se
 * marcan individualmente y se registran en bitácora con accion 'error'
 * (independiente de si el disparo fue manual o de la ejecución asistida).
 */
export async function ejecutarDescargaSolicitud(params: {
  solicitud: CfdiSatSolicitudRow;
  paquetesPendientes: CfdiSatPaqueteRow[];
  empresaId: number;
  empresaIdentificador: string;
  usuarioId: number;
  cerBuffer: Buffer;
  keyBuffer: Buffer;
  fielPassword: string;
}): Promise<ResultadoDescargaSolicitud> {
  const { solicitud, paquetesPendientes, empresaId, empresaIdentificador, usuarioId, cerBuffer, keyBuffer, fielPassword } =
    params;

  let nuevos = 0;
  let duplicados = 0;
  let paquetesConError = 0;
  let erroresParseo = 0;

  for (const paquete of paquetesPendientes) {
    try {
      const { zipBuffer } = await descargarPaqueteSat({
        cerBuffer,
        keyBuffer,
        fielPassword,
        packageId: paquete.sat_package_id,
      });

      const zipPath = await guardarZipPrivado({
        empresaIdentificador,
        solicitudId: solicitud.id,
        packageId: paquete.sat_package_id,
        contents: zipBuffer,
      });

      const { items, errores } = await extraerComprobantesDePaquete(zipBuffer, solicitud.tipo_solicitud);

      for (const item of items) {
        try {
          let xmlPath: string | null = null;
          if (item.xmlContent) {
            xmlPath = await guardarXmlPrivado({
              empresaIdentificador,
              uuid: item.uuid,
              contents: item.xmlContent,
            });
          }

          const insertado = await insertarComprobante({
            empresaId,
            solicitudId: solicitud.id,
            paqueteId: paquete.id,
            uuid: item.uuid,
            rfcEmisor: item.rfcEmisor,
            rfcReceptor: item.rfcReceptor,
            nombreEmisor: item.nombreEmisor,
            nombreReceptor: item.nombreReceptor,
            fechaEmision: item.fechaEmision,
            tipoComprobante: item.tipoComprobante,
            total: item.total,
            moneda: item.moneda,
            estatusSat: item.estatusSat,
            tipoDescarga: solicitud.tipo_descarga,
            xmlPath,
          });

          if (insertado) {
            nuevos += 1;
          } else {
            duplicados += 1;
          }
        } catch (itemError: any) {
          console.error('[CFDI SAT] Error al guardar comprobante', {
            empresaId,
            solicitudId: solicitud.id,
            paqueteId: paquete.id,
            message: itemError?.message,
          });
        }
      }

      await marcarPaqueteDescargado(paquete.id, zipPath);

      if (errores.length > 0) {
        erroresParseo += errores.length;
        await registrarBitacora({
          empresaId,
          usuarioId,
          accion: 'error',
          resultado: 'error',
          detalle: `solicitud_id=${solicitud.id}, paquete_id=${paquete.id}, ${errores.length} comprobante(s) con error de parseo`,
        });
      }
    } catch (error: any) {
      paquetesConError += 1;
      const mensaje =
        error instanceof SatClientError
          ? error.message
          : sanitizarMensajeError(error?.message, 'No se pudo descargar el paquete');

      console.error('[CFDI SAT] Error al descargar paquete del SAT', {
        accion: 'descargar_paquete_sat',
        empresaId,
        solicitudId: solicitud.id,
        paqueteId: paquete.id,
        satPackageId: paquete.sat_package_id,
        ...extraerDetalleErrorSat(error),
      });

      await marcarPaqueteError(paquete.id, mensaje);
      await registrarBitacora({
        empresaId,
        usuarioId,
        accion: 'error',
        resultado: 'error',
        detalle: `solicitud_id=${solicitud.id}, paquete_id=${paquete.id}: ${mensaje}`,
      });
    }
  }

  return { nuevos, duplicados, paquetesConError, erroresParseo };
}
