import pool from '../../../config/database';

export type CfdiSatBitacoraAccion =
  | 'credencial_subida'
  | 'credencial_eliminada'
  | 'autorizacion_aceptada'
  | 'solicitud_creada'
  | 'verificacion'
  | 'descarga_paquete'
  | 'importado_compras'
  | 'verificacion_automatica'
  | 'descarga_automatica'
  | 'automatizacion_error'
  | 'vinculacion_documento'
  | 'error';
export type CfdiSatBitacoraResultado = 'ok' | 'error';

interface RegistrarBitacoraParams {
  empresaId: number;
  usuarioId: number;
  accion: CfdiSatBitacoraAccion;
  resultado?: CfdiSatBitacoraResultado;
  detalle?: string | null;
}

/**
 * Nunca debe recibir contraseñas ni el contenido de los certificados en `detalle`.
 */
export async function registrarBitacora(params: RegistrarBitacoraParams): Promise<void> {
  await pool.query(
    `INSERT INTO core.cfdi_sat_bitacora (empresa_id, usuario_id, accion, resultado, detalle)
     VALUES ($1, $2, $3, $4, $5)`,
    [params.empresaId, params.usuarioId, params.accion, params.resultado ?? 'ok', params.detalle ?? null]
  );
}

export interface CfdiSatBitacoraRow {
  id: number;
  empresa_id: number;
  usuario_id: number;
  usuario_nombre: string | null;
  accion: CfdiSatBitacoraAccion;
  resultado: CfdiSatBitacoraResultado;
  detalle: string | null;
  creado_en: string;
}

export interface ListarBitacoraFiltros {
  /** 'YYYY-MM-DD' */
  fechaInicio?: string;
  fechaFin?: string;
  accion?: CfdiSatBitacoraAccion;
  usuarioId?: number;
  resultado?: CfdiSatBitacoraResultado;
  /**
   * La bitácora no tiene columnas propias para solicitud/comprobante: se
   * busca como texto dentro de `detalle` (donde cada acción ya embebe
   * `solicitud_id=`/`comprobante_id=`/el UUID). Es una búsqueda de mejor
   * esfuerzo, no una relación estructurada.
   */
  solicitudId?: number;
  comprobanteId?: number;
  uuid?: string;
  page?: number;
  pageSize?: number;
}

export interface ListarBitacoraResultado {
  rows: CfdiSatBitacoraRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listarBitacora(
  empresaId: number,
  filtros: ListarBitacoraFiltros = {}
): Promise<ListarBitacoraResultado> {
  const where: string[] = ['b.empresa_id = $1'];
  const values: any[] = [empresaId];

  const addFiltro = (sql: string, value: any) => {
    values.push(value);
    where.push(sql.replace('?', `$${values.length}`));
  };

  if (filtros.fechaInicio) addFiltro('b.creado_en >= ?', `${filtros.fechaInicio} 00:00:00`);
  if (filtros.fechaFin) addFiltro('b.creado_en <= ?', `${filtros.fechaFin} 23:59:59`);
  if (filtros.accion) addFiltro('b.accion = ?', filtros.accion);
  if (filtros.usuarioId) addFiltro('b.usuario_id = ?', filtros.usuarioId);
  if (filtros.resultado) addFiltro('b.resultado = ?', filtros.resultado);
  if (filtros.solicitudId) addFiltro('b.detalle ILIKE ?', `%solicitud_id=${filtros.solicitudId}%`);
  if (filtros.comprobanteId) addFiltro('b.detalle ILIKE ?', `%comprobante_id=${filtros.comprobanteId}%`);
  if (filtros.uuid) addFiltro('b.detalle ILIKE ?', `%${filtros.uuid}%`);

  const whereSql = where.join(' AND ');
  const page = Math.max(1, Math.trunc(filtros.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.trunc(filtros.pageSize ?? 25)));
  const offset = (page - 1) * pageSize;

  const { rows: countRows } = await pool.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM core.cfdi_sat_bitacora b WHERE ${whereSql}`,
    values
  );
  const total = Number(countRows[0]?.total ?? 0);

  const limitValues = [...values, pageSize, offset];
  const { rows } = await pool.query<CfdiSatBitacoraRow>(
    `SELECT b.id, b.empresa_id, b.usuario_id, u.nombre AS usuario_nombre,
            b.accion, b.resultado, b.detalle, b.creado_en
       FROM core.cfdi_sat_bitacora b
       LEFT JOIN core.usuarios u ON u.id = b.usuario_id
      WHERE ${whereSql}
      ORDER BY b.creado_en DESC
      LIMIT $${limitValues.length - 1} OFFSET $${limitValues.length}`,
    limitValues
  );

  return { rows, total, page, pageSize };
}
