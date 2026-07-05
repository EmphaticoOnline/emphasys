import pool from '../../../config/database';
import type { PoolClient } from 'pg';
import type { SatTipoDescarga } from './sat-client';

export type CfdiSatComprobanteEstatusSat = 'vigente' | 'cancelado';

export interface CfdiSatComprobanteRow {
  id: number;
  empresa_id: number;
  solicitud_id: number;
  paquete_id: number;
  uuid: string;
  rfc_emisor: string;
  rfc_receptor: string;
  nombre_emisor: string | null;
  nombre_receptor: string | null;
  fecha_emision: string | null;
  tipo_comprobante: string | null;
  total: string | null;
  moneda: string | null;
  estatus_sat: CfdiSatComprobanteEstatusSat | null;
  tipo_descarga: SatTipoDescarga;
  xml_path: string | null;
  importado_compras: boolean;
  documento_id: number | null;
  creado_en: string;
}

export interface InsertarComprobanteParams {
  empresaId: number;
  solicitudId: number;
  paqueteId: number;
  uuid: string;
  rfcEmisor: string;
  rfcReceptor: string;
  nombreEmisor: string | null;
  nombreReceptor: string | null;
  fechaEmision: string | null;
  tipoComprobante: string | null;
  total: number | null;
  moneda: string | null;
  estatusSat: CfdiSatComprobanteEstatusSat | null;
  tipoDescarga: SatTipoDescarga;
  xmlPath: string | null;
}

/**
 * Inserta un comprobante evitando duplicados por (empresa_id, uuid). Devuelve
 * true si se insertó una fila nueva, false si ya existía (no es un error).
 */
export async function insertarComprobante(params: InsertarComprobanteParams): Promise<boolean> {
  const { rows } = await pool.query(
    `INSERT INTO core.cfdi_sat_comprobantes
       (empresa_id, solicitud_id, paquete_id, uuid, rfc_emisor, rfc_receptor,
        nombre_emisor, nombre_receptor, fecha_emision, tipo_comprobante, total,
        moneda, estatus_sat, tipo_descarga, xml_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (empresa_id, uuid) DO NOTHING
     RETURNING id`,
    [
      params.empresaId,
      params.solicitudId,
      params.paqueteId,
      params.uuid,
      params.rfcEmisor,
      params.rfcReceptor,
      params.nombreEmisor,
      params.nombreReceptor,
      params.fechaEmision,
      params.tipoComprobante,
      params.total,
      params.moneda,
      params.estatusSat,
      params.tipoDescarga,
      params.xmlPath,
    ]
  );

  return rows.length > 0;
}

export interface ListarComprobantesFiltros {
  tipoDescarga?: SatTipoDescarga;
  uuid?: string;
  rfcEmisor?: string;
  rfcReceptor?: string;
  nombreEmisor?: string;
  nombreReceptor?: string;
  /** 'YYYY-MM-DD', filtra por fecha_emision */
  fechaInicio?: string;
  fechaFin?: string;
  tipoComprobante?: string;
  estatusSat?: CfdiSatComprobanteEstatusSat;
  importadoCompras?: boolean;
  solicitudId?: number;
  paqueteId?: number;
  page?: number;
  pageSize?: number;
}

export interface ListarComprobantesResultado {
  rows: CfdiSatComprobanteRow[];
  total: number;
  page: number;
  pageSize: number;
}

const COMPROBANTE_COLUMNS = `id, empresa_id, solicitud_id, paquete_id, uuid, rfc_emisor, rfc_receptor,
            nombre_emisor, nombre_receptor, fecha_emision, tipo_comprobante, total,
            moneda, estatus_sat, tipo_descarga, xml_path, importado_compras, documento_id, creado_en`;

export async function listarComprobantes(
  empresaId: number,
  filtros: ListarComprobantesFiltros = {}
): Promise<ListarComprobantesResultado> {
  const where: string[] = [];
  const values: any[] = [empresaId];
  where.push('empresa_id = $1');

  const addFiltro = (sql: string, value: any) => {
    values.push(value);
    where.push(sql.replace('?', `$${values.length}`));
  };

  if (filtros.tipoDescarga) addFiltro('tipo_descarga = ?', filtros.tipoDescarga);
  if (filtros.uuid) addFiltro('uuid ILIKE ?', `%${filtros.uuid}%`);
  if (filtros.rfcEmisor) addFiltro('rfc_emisor ILIKE ?', `%${filtros.rfcEmisor}%`);
  if (filtros.rfcReceptor) addFiltro('rfc_receptor ILIKE ?', `%${filtros.rfcReceptor}%`);
  if (filtros.nombreEmisor) addFiltro('nombre_emisor ILIKE ?', `%${filtros.nombreEmisor}%`);
  if (filtros.nombreReceptor) addFiltro('nombre_receptor ILIKE ?', `%${filtros.nombreReceptor}%`);
  if (filtros.fechaInicio) addFiltro('fecha_emision >= ?', `${filtros.fechaInicio} 00:00:00`);
  if (filtros.fechaFin) addFiltro('fecha_emision <= ?', `${filtros.fechaFin} 23:59:59`);
  if (filtros.tipoComprobante) addFiltro('tipo_comprobante = ?', filtros.tipoComprobante);
  if (filtros.estatusSat) addFiltro('estatus_sat = ?', filtros.estatusSat);
  if (filtros.importadoCompras !== undefined) addFiltro('importado_compras = ?', filtros.importadoCompras);
  if (filtros.solicitudId) addFiltro('solicitud_id = ?', filtros.solicitudId);
  if (filtros.paqueteId) addFiltro('paquete_id = ?', filtros.paqueteId);

  const whereSql = where.join(' AND ');

  const page = Math.max(1, Math.trunc(filtros.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.trunc(filtros.pageSize ?? 25)));
  const offset = (page - 1) * pageSize;

  const { rows: countRows } = await pool.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM core.cfdi_sat_comprobantes WHERE ${whereSql}`,
    values
  );
  const total = Number(countRows[0]?.total ?? 0);

  const limitValues = [...values, pageSize, offset];
  const { rows } = await pool.query<CfdiSatComprobanteRow>(
    `SELECT ${COMPROBANTE_COLUMNS}
       FROM core.cfdi_sat_comprobantes
      WHERE ${whereSql}
      ORDER BY fecha_emision DESC NULLS LAST, id DESC
      LIMIT $${limitValues.length - 1} OFFSET $${limitValues.length}`,
    limitValues
  );

  return { rows, total, page, pageSize };
}

export async function obtenerComprobantePorId(id: number, empresaId: number): Promise<CfdiSatComprobanteRow | null> {
  const { rows } = await pool.query<CfdiSatComprobanteRow>(
    `SELECT ${COMPROBANTE_COLUMNS}
       FROM core.cfdi_sat_comprobantes
      WHERE id = $1
        AND empresa_id = $2
      LIMIT 1`,
    [id, empresaId]
  );

  return rows[0] ?? null;
}

/**
 * Igual que obtenerComprobantePorId pero con FOR UPDATE: se usa justo antes de
 * importar a compras para evitar que dos requests concurrentes importen el
 * mismo comprobante dos veces (condición de carrera de doble clic).
 */
export async function bloquearComprobantePorId(
  id: number,
  empresaId: number,
  client: PoolClient
): Promise<CfdiSatComprobanteRow | null> {
  const { rows } = await client.query<CfdiSatComprobanteRow>(
    `SELECT ${COMPROBANTE_COLUMNS}
       FROM core.cfdi_sat_comprobantes
      WHERE id = $1
        AND empresa_id = $2
      LIMIT 1
      FOR UPDATE`,
    [id, empresaId]
  );

  return rows[0] ?? null;
}

export async function marcarComprobanteImportado(
  id: number,
  documentoId: number,
  client: PoolClient
): Promise<void> {
  await client.query(
    `UPDATE core.cfdi_sat_comprobantes
        SET importado_compras = true,
            documento_id = $2
      WHERE id = $1`,
    [id, documentoId]
  );
}
