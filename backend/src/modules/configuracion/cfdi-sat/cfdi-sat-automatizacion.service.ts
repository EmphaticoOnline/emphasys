import pool from '../../../config/database';
import { obtenerEmpresaPorId } from '../../../services/empresasService';
import { CfdiSatValidacionError, obtenerCredencialesFielListas } from './cfdi-sat.shared';
import { obtenerAutomatizacion, marcarUltimoRun } from './cfdi-sat-automatizacion.repository';
import {
  listarSolicitudesConPaquetesPendientes,
  listarSolicitudesParaVerificar,
} from './cfdi-sat-solicitudes.repository';
import { listarPaquetesPendientesOError } from './cfdi-sat-paquetes.repository';
import { ejecutarDescargaSolicitud, ejecutarVerificacionSolicitud } from './cfdi-sat-solicitudes.service';
import { registrarBitacora } from './cfdi-sat-bitacora.repository';
import { SatClientError } from './sat-client';

/**
 * Ejecución asistida de Fase 9: NO es un cron desatendido (ver
 * docs/cfdi-sat-descarga.md, sección Automatización, para el diagnóstico de
 * por qué). Un administrador la dispara a demanda capturando la contraseña de
 * la FIEL una sola vez, y esta función procesa TODAS las solicitudes
 * elegibles de la empresa activa (verificación y/o descarga, según lo que
 * esté activado en la configuración) en esa misma llamada.
 */

// Namespace fijo y arbitrario para no chocar con otros advisory locks del sistema.
const LOCK_NAMESPACE = 727001;
// Pequeña pausa entre llamadas al SAT para no generar ráfagas agresivas (Alcance 5).
const PAUSA_ENTRE_SOLICITUDES_MS = 800;

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Toma un advisory lock de Postgres por empresa para evitar que dos
 * ejecuciones asistidas corran en paralelo para la misma empresa (doble clic,
 * dos pestañas, etc.). El lock vive en la conexión, así que se adquiere y
 * libera con el mismo client dedicado.
 */
async function conLockPorEmpresa<T>(empresaId: number, fn: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1, $2) AS locked', [
      LOCK_NAMESPACE,
      empresaId,
    ]);

    if (!rows[0]?.locked) {
      throw new CfdiSatValidacionError(
        'Ya hay una ejecución de automatización en curso para esta empresa. Intenta de nuevo en unos minutos.',
        409
      );
    }

    try {
      return await fn();
    } finally {
      await client.query('SELECT pg_advisory_unlock($1, $2)', [LOCK_NAMESPACE, empresaId]);
    }
  } finally {
    client.release();
  }
}

export interface ResultadoEjecucionAutomatizacion {
  solicitudesVerificadas: number;
  solicitudesConErrorVerificacion: number;
  solicitudesDescargadas: number;
  comprobantesNuevos: number;
  paquetesConError: number;
  mensajes: string[];
}

export async function ejecutarAutomatizacionAsistida(params: {
  empresaId: number;
  usuarioId: number;
  fielPassword: string;
}): Promise<ResultadoEjecucionAutomatizacion> {
  const { empresaId, usuarioId, fielPassword } = params;

  return conLockPorEmpresa(empresaId, async () => {
    const config = await obtenerAutomatizacion(empresaId);
    if (!config.auto_verificar && !config.auto_descargar) {
      throw new CfdiSatValidacionError(
        'La automatización no está activada para esta empresa. Actívala en la sección Automatización antes de ejecutarla.'
      );
    }

    const empresa = await obtenerEmpresaPorId(empresaId);
    if (!empresa) {
      throw new CfdiSatValidacionError('Empresa no encontrada');
    }

    // Valida FIEL vigente + autorización vigente, y descifra los certificados en memoria.
    const { cerBuffer, keyBuffer } = await obtenerCredencialesFielListas(empresaId);

    const resultado: ResultadoEjecucionAutomatizacion = {
      solicitudesVerificadas: 0,
      solicitudesConErrorVerificacion: 0,
      solicitudesDescargadas: 0,
      comprobantesNuevos: 0,
      paquetesConError: 0,
      mensajes: [],
    };

    try {
      if (config.auto_verificar) {
        const pendientes = await listarSolicitudesParaVerificar(empresaId);

        for (const solicitud of pendientes) {
          try {
            const verificacion = await ejecutarVerificacionSolicitud({ solicitud, cerBuffer, keyBuffer, fielPassword });
            resultado.solicitudesVerificadas += 1;
            await registrarBitacora({
              empresaId,
              usuarioId,
              accion: 'verificacion_automatica',
              detalle: `solicitud_id=${solicitud.id}, estatus=${verificacion.estatus}, paquetes=${verificacion.paquetesNuevos}, cfdis=${verificacion.numeroCfdis}`,
            });
          } catch (error: any) {
            resultado.solicitudesConErrorVerificacion += 1;
            const mensaje =
              error instanceof SatClientError ? error.message : 'No se pudo verificar la solicitud ante el SAT';
            resultado.mensajes.push(`Solicitud ${solicitud.id}: ${mensaje}`);
            await registrarBitacora({
              empresaId,
              usuarioId,
              accion: 'automatizacion_error',
              resultado: 'error',
              detalle: `verificacion, solicitud_id=${solicitud.id}: ${mensaje}`,
            });
          }

          await esperar(PAUSA_ENTRE_SOLICITUDES_MS);
        }
      }

      if (config.auto_descargar) {
        const terminadas = await listarSolicitudesConPaquetesPendientes(empresaId);

        for (const solicitud of terminadas) {
          try {
            const paquetesPendientes = await listarPaquetesPendientesOError(solicitud.id);
            if (paquetesPendientes.length === 0) continue;

            const descarga = await ejecutarDescargaSolicitud({
              solicitud,
              paquetesPendientes,
              empresaId,
              empresaIdentificador: empresa.identificador,
              usuarioId,
              cerBuffer,
              keyBuffer,
              fielPassword,
            });

            resultado.solicitudesDescargadas += 1;
            resultado.comprobantesNuevos += descarga.nuevos;
            resultado.paquetesConError += descarga.paquetesConError;

            await registrarBitacora({
              empresaId,
              usuarioId,
              accion: 'descarga_automatica',
              detalle: `solicitud_id=${solicitud.id}, paquetes_procesados=${paquetesPendientes.length}, nuevos=${descarga.nuevos}, duplicados=${descarga.duplicados}, con_error=${descarga.paquetesConError}`,
            });
          } catch (error: any) {
            const mensaje = String(error?.message ?? 'No se pudo descargar los paquetes').slice(0, 500);
            resultado.mensajes.push(`Solicitud ${solicitud.id}: ${mensaje}`);
            await registrarBitacora({
              empresaId,
              usuarioId,
              accion: 'automatizacion_error',
              resultado: 'error',
              detalle: `descarga, solicitud_id=${solicitud.id}: ${mensaje}`,
            });
          }

          await esperar(PAUSA_ENTRE_SOLICITUDES_MS);
        }
      }
    } finally {
      await marcarUltimoRun(empresaId);
    }

    return resultado;
  });
}
