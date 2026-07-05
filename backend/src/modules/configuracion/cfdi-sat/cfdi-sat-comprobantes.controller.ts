import type { Request, Response } from 'express';
import pool from '../../../config/database';
import {
  bloquearComprobantePorId,
  listarComprobantes,
  obtenerComprobantePorId,
  type CfdiSatComprobanteEstatusSat,
  type CfdiSatComprobanteRow,
  type ListarComprobantesFiltros,
} from './cfdi-sat-comprobantes.repository';
import { obtenerSolicitudPorId } from './cfdi-sat-solicitudes.repository';
import { obtenerPaquetePorId } from './cfdi-sat-paquetes.repository';
import { leerArchivoPrivado } from './cfdi-sat-storage';
import { registrarBitacora } from './cfdi-sat-bitacora.repository';
import {
  assertEsAdministrador,
  CfdiSatPermisoError,
  CfdiSatValidacionError,
  getEmpresaId,
  getUserId,
} from './cfdi-sat.shared';
import {
  ejecutarImportacionCompras,
  prepararImportacionCompras,
  type ImportacionEjecutada,
} from './cfdi-sat-compras-import.service';
import { evaluarEstadoImportacion, evaluarEstadoImportacionLote } from './cfdi-sat-evaluacion-importacion.service';
import { listarCandidatosParaComprobante, vincularComprobanteADocumento } from './cfdi-sat-vinculacion.service';
import type { SatTipoDescarga } from './sat-client';

const TIPOS_DESCARGA: SatTipoDescarga[] = ['emitidos', 'recibidos'];
const ESTATUS_SAT: CfdiSatComprobanteEstatusSat[] = ['vigente', 'cancelado'];
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Nunca exponer xml_path (ruta interna del storage privado): solo un booleano. */
function toPublicComprobante(row: CfdiSatComprobanteRow) {
  const { xml_path, ...publico } = row;
  return { ...publico, tiene_xml: Boolean(xml_path) };
}

function parseStringParam(value: unknown): string | undefined {
  const texto = typeof value === 'string' ? value.trim() : '';
  return texto ? texto : undefined;
}

function parseIntParam(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function parseFiltros(query: Request['query']): ListarComprobantesFiltros {
  const filtros: ListarComprobantesFiltros = {};

  const tipoDescarga = parseStringParam(query.tipo_descarga);
  if (tipoDescarga && TIPOS_DESCARGA.includes(tipoDescarga as SatTipoDescarga)) {
    filtros.tipoDescarga = tipoDescarga as SatTipoDescarga;
  }

  filtros.uuid = parseStringParam(query.uuid);
  filtros.rfcEmisor = parseStringParam(query.rfc_emisor);
  filtros.rfcReceptor = parseStringParam(query.rfc_receptor);
  filtros.nombreEmisor = parseStringParam(query.nombre_emisor);
  filtros.nombreReceptor = parseStringParam(query.nombre_receptor);

  const fechaInicio = parseStringParam(query.fecha_inicio);
  if (fechaInicio && FECHA_REGEX.test(fechaInicio)) filtros.fechaInicio = fechaInicio;

  const fechaFin = parseStringParam(query.fecha_fin);
  if (fechaFin && FECHA_REGEX.test(fechaFin)) filtros.fechaFin = fechaFin;

  filtros.tipoComprobante = parseStringParam(query.tipo_comprobante)?.toUpperCase();

  const estatusSat = parseStringParam(query.estatus_sat)?.toLowerCase();
  if (estatusSat && ESTATUS_SAT.includes(estatusSat as CfdiSatComprobanteEstatusSat)) {
    filtros.estatusSat = estatusSat as CfdiSatComprobanteEstatusSat;
  }

  const importado = parseStringParam(query.importado_compras)?.toLowerCase();
  if (importado === 'true') filtros.importadoCompras = true;
  if (importado === 'false') filtros.importadoCompras = false;

  filtros.solicitudId = parseIntParam(query.solicitud_id);
  filtros.paqueteId = parseIntParam(query.paquete_id);
  filtros.page = parseIntParam(query.page) ?? 1;
  filtros.pageSize = parseIntParam(query.pageSize) ?? 25;

  return filtros;
}

/**
 * La evaluación operativa (Fase 10) puede leer el XML de cada comprobante
 * elegible para clasificarlo (proveedor, impuestos, etc.), así que
 * deliberadamente solo se calcula para la página actual devuelta por
 * listarComprobantes() — nunca para todo el resultado filtrado — para no
 * convertir un listado paginado en una operación costosa. Ver Alcance 5,
 * Fase 10, y docs/cfdi-sat-descarga.md.
 */
export async function listarComprobantesController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const filtros = parseFiltros(req.query);
    const resultado = await listarComprobantes(empresaId, filtros);

    const incluirEvaluacion = parseStringParam(req.query.incluir_evaluacion)?.toLowerCase() === 'true';
    const evaluaciones = incluirEvaluacion ? await evaluarEstadoImportacionLote(resultado.rows, empresaId) : null;
    const evaluacionPorId = new Map(evaluaciones?.map((evaluacion) => [evaluacion.comprobante_id, evaluacion]));

    return res.json({
      comprobantes: resultado.rows.map((row) => ({
        ...toPublicComprobante(row),
        evaluacion: evaluacionPorId.get(row.id) ?? null,
      })),
      total: resultado.total,
      page: resultado.page,
      pageSize: resultado.pageSize,
    });
  } catch (error) {
    console.error('[CFDI SAT] Error al listar comprobantes', error);
    return res.status(500).json({ message: 'No se pudieron obtener los comprobantes' });
  }
}

export async function obtenerComprobanteDetalleController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const comprobanteId = Number(req.params.id ?? 0);

    if (!Number.isInteger(comprobanteId) || comprobanteId <= 0) {
      return res.status(400).json({ message: 'id de comprobante inválido' });
    }

    const comprobante = await obtenerComprobantePorId(comprobanteId, empresaId);
    if (!comprobante) {
      return res.status(404).json({ message: 'Comprobante no encontrado' });
    }

    const [solicitud, paquete, evaluacion] = await Promise.all([
      obtenerSolicitudPorId(comprobante.solicitud_id, empresaId),
      obtenerPaquetePorId(comprobante.paquete_id),
      evaluarEstadoImportacion(comprobante, empresaId),
    ]);

    return res.json({
      comprobante: toPublicComprobante(comprobante),
      evaluacion,
      solicitud: solicitud
        ? {
            id: solicitud.id,
            tipo_descarga: solicitud.tipo_descarga,
            tipo_solicitud: solicitud.tipo_solicitud,
            fecha_inicio: solicitud.fecha_inicio,
            fecha_fin: solicitud.fecha_fin,
            estatus: solicitud.estatus,
            sat_request_id: solicitud.sat_request_id,
          }
        : null,
      paquete: paquete
        ? {
            id: paquete.id,
            sat_package_id: paquete.sat_package_id,
            estatus: paquete.estatus,
            descargado_en: paquete.descargado_en,
          }
        : null,
    });
  } catch (error) {
    console.error('[CFDI SAT] Error al obtener detalle de comprobante', error);
    return res.status(500).json({ message: 'No se pudo obtener el detalle del comprobante' });
  }
}

/**
 * Sirve el XML por streaming desde storage privado. Nunca expone la ruta física
 * ni pasa por express.static; solo responde el contenido si el comprobante
 * pertenece a la empresa activa.
 */
export async function descargarXmlComprobanteController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const comprobanteId = Number(req.params.id ?? 0);

    if (!Number.isInteger(comprobanteId) || comprobanteId <= 0) {
      return res.status(400).json({ message: 'id de comprobante inválido' });
    }

    const comprobante = await obtenerComprobantePorId(comprobanteId, empresaId);
    if (!comprobante) {
      return res.status(404).json({ message: 'Comprobante no encontrado' });
    }

    if (!comprobante.xml_path) {
      return res.status(404).json({ message: 'Este comprobante no tiene XML disponible (solicitud de tipo metadata)' });
    }

    const contents = await leerArchivoPrivado(comprobante.xml_path);

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${comprobante.uuid}.xml"`);
    return res.send(contents);
  } catch (error) {
    console.error('[CFDI SAT] Error al obtener XML de comprobante', error);
    return res.status(500).json({ message: 'No se pudo obtener el XML del comprobante' });
  }
}

/**
 * Dry-run: valida elegibilidad, parsea el XML y resuelve el proveedor SIN
 * escribir nada en base de datos. Usado por el frontend para mostrar el
 * diálogo de confirmación antes de importar (o el motivo de rechazo).
 */
export async function previsualizarImportacionComprasController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const comprobanteId = Number(req.params.id ?? 0);

    if (!Number.isInteger(comprobanteId) || comprobanteId <= 0) {
      return res.status(400).json({ message: 'id de comprobante inválido' });
    }

    const comprobante = await obtenerComprobantePorId(comprobanteId, empresaId);
    if (!comprobante) {
      return res.status(404).json({ message: 'Comprobante no encontrado' });
    }

    const { parsedCfdi, proveedor } = await prepararImportacionCompras(comprobante, empresaId);

    return res.json({
      uuid: parsedCfdi.uuid,
      emisor: { rfc: parsedCfdi.rfcEmisor, nombre: parsedCfdi.nombreEmisor },
      fecha: parsedCfdi.fecha,
      total: parsedCfdi.total,
      moneda: parsedCfdi.moneda,
      numero_conceptos: parsedCfdi.conceptos.length,
      proveedor: { id: proveedor.id, nombre: proveedor.nombre },
    });
  } catch (error: any) {
    if (error instanceof CfdiSatValidacionError) {
      return res.status(error.status).json({ message: error.message, code: error.code });
    }
    console.error('[CFDI SAT] Error al previsualizar importación a compras', error);
    return res.status(500).json({ message: 'No se pudo previsualizar la importación' });
  }
}

interface ResultadoImportacionItem {
  id: number;
  uuid: string | null;
  ok: boolean;
  documento?: ImportacionEjecutada;
  mensajeError?: string;
  code?: string;
  status: number;
}

/**
 * Importa un comprobante dentro de su propia transacción (lock de fila,
 * ejecución, commit/rollback, bitácora). Es la unidad reutilizada tanto por el
 * endpoint de importación individual como por el de importación por lote, para
 * que ambos respeten exactamente las mismas reglas de elegibilidad, idempotencia
 * y auditoría.
 */
async function importarComprobanteTransaccional(params: {
  empresaId: number;
  usuarioId: number;
  comprobanteId: number;
}): Promise<ResultadoImportacionItem> {
  const { empresaId, usuarioId, comprobanteId } = params;
  const client = await pool.connect();
  let uuid: string | null = null;

  try {
    await client.query('BEGIN');

    const comprobante = await bloquearComprobantePorId(comprobanteId, empresaId, client);
    if (!comprobante) {
      await client.query('ROLLBACK');
      return { id: comprobanteId, uuid: null, ok: false, mensajeError: 'Comprobante no encontrado', status: 404 };
    }
    uuid = comprobante.uuid;

    const documento = await ejecutarImportacionCompras({ comprobante, empresaId, usuarioId, client });

    await client.query('COMMIT');

    await registrarBitacora({
      empresaId,
      usuarioId,
      accion: 'importado_compras',
      detalle: `comprobante_id=${comprobanteId}, uuid=${uuid}, documento_id=${documento.documentoId}, proveedor_id=${documento.contactoId}`,
    });

    return { id: comprobanteId, uuid, ok: true, documento, status: 201 };
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});

    const esValidacion = error instanceof CfdiSatValidacionError;
    const mensaje = esValidacion ? error.message : 'No se pudo importar el comprobante a compras';
    const status = esValidacion ? error.status : 500;
    const code = esValidacion ? error.code : undefined;

    if (!esValidacion) {
      console.error('[CFDI SAT] Error al importar comprobante a compras', {
        empresaId,
        comprobanteId,
        message: error?.message,
      });
    }

    await registrarBitacora({
      empresaId,
      usuarioId,
      accion: 'error',
      resultado: 'error',
      detalle: `comprobante_id=${comprobanteId}: ${String(mensaje).slice(0, 500)}`,
    }).catch(() => {});

    return { id: comprobanteId, uuid, ok: false, mensajeError: mensaje, code, status };
  } finally {
    client.release();
  }
}

function toPublicDocumentoImportado(documento: ImportacionEjecutada) {
  return {
    id: documento.documentoId,
    tipo_documento: documento.tipoDocumento,
    estatus_documento: documento.estatusDocumento,
    serie: documento.serie,
    numero: documento.numero,
    serie_externa: documento.serieExterna,
    numero_externo: documento.numeroExterno,
    total: documento.total,
    contacto_id: documento.contactoId,
    contacto_nombre: documento.contactoNombre,
  };
}

/**
 * Crea la factura de compra en borrador y marca el comprobante como
 * importado. Vuelve a validar todo desde cero bajo lock de fila (no confía en
 * lo que haya devuelto el preview) para evitar condiciones de carrera.
 */
export async function importarComprobanteComprasController(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  const usuarioId = getUserId(req);
  const comprobanteId = Number(req.params.id ?? 0);

  try {
    await assertEsAdministrador(req);
  } catch (error: any) {
    if (error instanceof CfdiSatPermisoError) {
      return res.status(403).json({ message: error.message });
    }
    console.error('[CFDI SAT] Error al validar permisos de importación', error);
    return res.status(500).json({ message: 'No se pudo validar el permiso de importación' });
  }

  if (!Number.isInteger(comprobanteId) || comprobanteId <= 0) {
    return res.status(400).json({ message: 'id de comprobante inválido' });
  }

  const resultado = await importarComprobanteTransaccional({ empresaId, usuarioId, comprobanteId });

  if (!resultado.ok || !resultado.documento) {
    return res.status(resultado.status).json({ message: resultado.mensajeError, code: resultado.code });
  }

  return res.status(201).json({ documento: toPublicDocumentoImportado(resultado.documento) });
}

/**
 * Importa varios comprobantes en una sola llamada. Cada comprobante se procesa
 * en su propia transacción independiente (importarComprobanteTransaccional):
 * si uno falla, no afecta a los demás. Se limita el tamaño del lote para no
 * dejar la request colgada indefinidamente con un arreglo enorme.
 */
const TAMANO_MAXIMO_LOTE = 200;

export async function importarComprobantesLoteController(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  const usuarioId = getUserId(req);

  try {
    await assertEsAdministrador(req);
  } catch (error: any) {
    if (error instanceof CfdiSatPermisoError) {
      return res.status(403).json({ message: error.message });
    }
    console.error('[CFDI SAT] Error al validar permisos de importación por lote', error);
    return res.status(500).json({ message: 'No se pudo validar el permiso de importación' });
  }

  const idsCrudos = req.body?.comprobante_ids;
  if (!Array.isArray(idsCrudos) || idsCrudos.length === 0) {
    return res.status(400).json({ message: 'comprobante_ids debe ser un arreglo no vacío' });
  }

  const idsValidos = Array.from(
    new Set(
      idsCrudos
        .map((valor: unknown) => Number(valor))
        .filter((valor: number) => Number.isInteger(valor) && valor > 0)
    )
  );

  if (idsValidos.length === 0) {
    return res.status(400).json({ message: 'comprobante_ids no contiene ids válidos' });
  }

  const idsAProcesar = idsValidos.slice(0, TAMANO_MAXIMO_LOTE);

  const resultados: Array<{
    id: number;
    uuid: string | null;
    ok: boolean;
    documento_id?: number;
    mensaje_error?: string;
    code?: string;
  }> = [];

  for (const comprobanteId of idsAProcesar) {
    const resultado = await importarComprobanteTransaccional({ empresaId, usuarioId, comprobanteId });
    resultados.push({
      id: resultado.id,
      uuid: resultado.uuid,
      ok: resultado.ok,
      documento_id: resultado.documento?.documentoId,
      mensaje_error: resultado.ok ? undefined : resultado.mensajeError,
      code: resultado.code,
    });
  }

  const importados = resultados.filter((r) => r.ok).length;
  const fallidos = resultados.length - importados;

  return res.status(200).json({
    resultados,
    resumen: { total: resultados.length, importados, fallidos },
  });
}

/**
 * Candidatos para vincular manualmente este comprobante a una factura de
 * compra ya capturada (Fase 11, Alcance 2). Solo lectura: no requiere
 * permiso de administrador, igual que la previsualización de importación.
 */
export async function listarCandidatosVinculacionController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const comprobanteId = Number(req.params.id ?? 0);

    if (!Number.isInteger(comprobanteId) || comprobanteId <= 0) {
      return res.status(400).json({ message: 'id de comprobante inválido' });
    }

    const comprobante = await obtenerComprobantePorId(comprobanteId, empresaId);
    if (!comprobante) {
      return res.status(404).json({ message: 'Comprobante no encontrado' });
    }

    const candidatos = await listarCandidatosParaComprobante(comprobante, empresaId);
    return res.json({ candidatos });
  } catch (error) {
    console.error('[CFDI SAT] Error al listar candidatos de vinculación', error);
    return res.status(500).json({ message: 'No se pudieron obtener los candidatos de vinculación' });
  }
}

/**
 * Vincula el comprobante a una factura de compra ya existente, sin crear un
 * documento nuevo (Fase 11, Alcance 1). Todas las validaciones de negocio
 * (RFC, total, serie/folio, cancelación, UUID duplicado) viven en
 * cfdi-sat-vinculacion.service.ts.
 */
export async function vincularDocumentoController(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  const usuarioId = getUserId(req);
  const comprobanteId = Number(req.params.id ?? 0);

  try {
    await assertEsAdministrador(req);
  } catch (error: any) {
    if (error instanceof CfdiSatPermisoError) {
      return res.status(403).json({ message: error.message });
    }
    console.error('[CFDI SAT] Error al validar permisos de vinculación', error);
    return res.status(500).json({ message: 'No se pudo validar el permiso de vinculación' });
  }

  if (!Number.isInteger(comprobanteId) || comprobanteId <= 0) {
    return res.status(400).json({ message: 'id de comprobante inválido' });
  }

  const documentoId = Number(req.body?.documento_id ?? 0);
  if (!Number.isInteger(documentoId) || documentoId <= 0) {
    return res.status(400).json({ message: 'documento_id es obligatorio y debe ser un entero válido' });
  }

  try {
    const resultado = await vincularComprobanteADocumento({ comprobanteId, documentoId, empresaId, usuarioId });

    await registrarBitacora({
      empresaId,
      usuarioId,
      accion: 'vinculacion_documento',
      detalle: `comprobante_id=${resultado.comprobanteId}, uuid=${resultado.uuid}, documento_id=${resultado.documentoId}`,
    });

    return res.json({
      documento_id: resultado.documentoId,
      comprobante_id: resultado.comprobanteId,
      uuid: resultado.uuid,
      proveedor_id: resultado.proveedorId,
      proveedor_nombre: resultado.proveedorNombre,
    });
  } catch (error: any) {
    const esValidacion = error instanceof CfdiSatValidacionError;
    const mensaje = esValidacion ? error.message : 'No se pudo vincular el comprobante a la factura seleccionada';
    const status = esValidacion ? error.status : 500;
    const code = esValidacion ? error.code : undefined;

    if (!esValidacion) {
      console.error('[CFDI SAT] Error al vincular comprobante a documento', {
        empresaId,
        comprobanteId,
        documentoId,
        message: error?.message,
      });
    }

    await registrarBitacora({
      empresaId,
      usuarioId,
      accion: 'error',
      resultado: 'error',
      detalle: `vinculacion, comprobante_id=${comprobanteId}, documento_id=${documentoId}: ${String(mensaje).slice(0, 500)}`,
    }).catch(() => {});

    return res.status(status).json({ message: mensaje, code });
  }
}
