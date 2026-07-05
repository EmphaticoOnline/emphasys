import pool from '../../../config/database';

export type CfdiSatPaqueteEstatus = 'pendiente' | 'descargado' | 'error';

export interface CfdiSatPaqueteRow {
  id: number;
  solicitud_id: number;
  sat_package_id: string;
  estatus: CfdiSatPaqueteEstatus;
  zip_path: string | null;
  descargado_en: string | null;
  mensaje_error: string | null;
  creado_en: string;
}

/**
 * Inserta los packageIds nuevos devueltos por verify(). ON CONFLICT DO NOTHING
 * evita duplicados si el usuario vuelve a verificar la misma solicitud.
 */
export async function insertarPaquetesPendientes(solicitudId: number, satPackageIds: string[]): Promise<void> {
  if (satPackageIds.length === 0) return;

  const values: any[] = [];
  const placeholders = satPackageIds
    .map((packageId, index) => {
      values.push(solicitudId, packageId);
      const base = index * 2;
      return `($${base + 1}, $${base + 2})`;
    })
    .join(', ');

  await pool.query(
    `INSERT INTO core.cfdi_sat_paquetes (solicitud_id, sat_package_id)
     VALUES ${placeholders}
     ON CONFLICT (solicitud_id, sat_package_id) DO NOTHING`,
    values
  );
}

export async function listarPaquetesPendientesOError(solicitudId: number): Promise<CfdiSatPaqueteRow[]> {
  const { rows } = await pool.query<CfdiSatPaqueteRow>(
    `SELECT id, solicitud_id, sat_package_id, estatus, zip_path, descargado_en, mensaje_error, creado_en
       FROM core.cfdi_sat_paquetes
      WHERE solicitud_id = $1
        AND estatus IN ('pendiente', 'error')
      ORDER BY id ASC`,
    [solicitudId]
  );

  return rows;
}

export async function marcarPaqueteDescargado(id: number, zipPath: string): Promise<void> {
  await pool.query(
    `UPDATE core.cfdi_sat_paquetes
        SET estatus = 'descargado',
            zip_path = $2,
            descargado_en = NOW(),
            mensaje_error = NULL
      WHERE id = $1`,
    [id, zipPath]
  );
}

export async function marcarPaqueteError(id: number, mensajeError: string): Promise<void> {
  await pool.query(
    `UPDATE core.cfdi_sat_paquetes
        SET estatus = 'error',
            mensaje_error = $2
      WHERE id = $1`,
    [id, mensajeError.slice(0, 1000)]
  );
}

export async function obtenerPaquetePorId(id: number): Promise<CfdiSatPaqueteRow | null> {
  const { rows } = await pool.query<CfdiSatPaqueteRow>(
    `SELECT id, solicitud_id, sat_package_id, estatus, zip_path, descargado_en, mensaje_error, creado_en
       FROM core.cfdi_sat_paquetes
      WHERE id = $1
      LIMIT 1`,
    [id]
  );

  return rows[0] ?? null;
}

export interface CfdiSatPaqueteConConteoRow extends CfdiSatPaqueteRow {
  total_comprobantes: number;
}

/** Todos los paquetes de una solicitud (no solo pendientes/error), con conteo de comprobantes extraídos. */
export async function listarPaquetesPorSolicitud(solicitudId: number): Promise<CfdiSatPaqueteConConteoRow[]> {
  const { rows } = await pool.query<CfdiSatPaqueteConConteoRow>(
    `SELECT p.id, p.solicitud_id, p.sat_package_id, p.estatus, p.zip_path, p.descargado_en,
            p.mensaje_error, p.creado_en,
            COALESCE(c.total_comprobantes, 0) AS total_comprobantes
       FROM core.cfdi_sat_paquetes p
       LEFT JOIN (
         SELECT paquete_id, COUNT(*) AS total_comprobantes
           FROM core.cfdi_sat_comprobantes
          GROUP BY paquete_id
       ) c ON c.paquete_id = p.id
      WHERE p.solicitud_id = $1
      ORDER BY p.id ASC`,
    [solicitudId]
  );

  return rows;
}
