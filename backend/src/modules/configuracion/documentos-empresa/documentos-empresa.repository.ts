import pool from '../../../config/database';

export type AfectaInventario = 'none' | 'entrada' | 'salida' | 'transferencia';

export type DocumentoEmpresa = {
  id: number;
  codigo: string;
  nombre: string;
  nombre_plural: string;
  icono: string | null;
  orden: number;
  habilitado: boolean;
  whatsapp_plantilla_default_id: number | null;
  /** Override de la empresa. null = heredar del catálogo. */
  afecta_inventario: AfectaInventario | null;
  /** Default del catálogo global (core.tipos_documento). Solo lectura. */
  afecta_inventario_sistema: AfectaInventario | null;
  afecta_reservado: boolean;
  usar_especificaciones: boolean;
  usar_especificaciones_empresa: boolean;
};

export type TransicionDocumento = {
  tipo_documento_origen_id: number;
  tipo_documento_destino_id: number;
  activo: boolean;
};

export async function obtenerDocumentosEmpresa(empresaId: number): Promise<DocumentoEmpresa[]> {
  const query = `
    SELECT
      td.id,
      td.codigo,
      td.nombre,
      td.nombre_plural,
      td.icono,
      td.orden,
      COALESCE(etd.activo, FALSE) AS habilitado,
      etd.whatsapp_plantilla_default_id,
      etd.afecta_inventario,
      td.afecta_inventario AS afecta_inventario_sistema,
      COALESCE(etd.afecta_reservado, FALSE) AS afecta_reservado
      ,COALESCE(etd.usar_especificaciones, FALSE) AS usar_especificaciones
      ,COALESCE((
        SELECT CASE WHEN LOWER(COALESCE(pe.valor, p.valor_default, 'false')) IN ('1', 'true', 't', 'yes', 'si', 'sí', 'on') THEN TRUE ELSE FALSE END
          FROM core.parametros p
     LEFT JOIN core.parametros_empresa pe ON pe.parametro_id = p.parametro_id AND pe.empresa_id = $1
         WHERE p.clave = 'usar_especificaciones_productos'
         LIMIT 1
      ), FALSE) AS usar_especificaciones_empresa
    FROM core.tipos_documento td
    LEFT JOIN core.empresas_tipos_documento etd
      ON etd.tipo_documento_id = td.id
     AND etd.empresa_id = $1
    WHERE td.activo = TRUE
    ORDER BY td.orden, td.nombre;
  `;

  const { rows } = await pool.query<DocumentoEmpresa>(query, [empresaId]);
  return rows;
}

export async function documentoEstaHabilitado(empresaId: number, tipoDocumentoId: number): Promise<boolean> {
  const { rows } = await pool.query<{ existe: boolean }>(
    `SELECT COALESCE(activo, FALSE) AS existe
       FROM core.empresas_tipos_documento
      WHERE empresa_id = $1 AND tipo_documento_id = $2
      LIMIT 1`,
    [empresaId, tipoDocumentoId]
  );

  return rows[0]?.existe ?? false;
}

export async function existeTipoDocumento(tipoDocumentoId: number): Promise<boolean> {
  const { rows } = await pool.query<{ existe: boolean }>(
    `SELECT EXISTS (
        SELECT 1 FROM core.tipos_documento
         WHERE id = $1
           AND activo = TRUE
      ) AS existe`,
    [tipoDocumentoId]
  );

  return rows[0]?.existe ?? false;
}

export async function upsertDocumentoEmpresa(
  empresaId: number,
  tipoDocumentoId: number,
  activo: boolean,
  includeWhatsappPlantillaDefault: boolean,
  whatsappPlantillaDefaultId: number | null,
  afectaInventario: AfectaInventario | null = null,
  afectaReservado: boolean = false,
  includeUsarEspecificaciones: boolean = false,
  usarEspecificaciones: boolean = false,
): Promise<{ empresa_id: number; tipo_documento_id: number; activo: boolean; whatsapp_plantilla_default_id: number | null; afecta_inventario: AfectaInventario | null; afecta_reservado: boolean; usar_especificaciones: boolean } | null> {
  const { rows } = await pool.query<{
    empresa_id: number;
    tipo_documento_id: number;
    activo: boolean;
    whatsapp_plantilla_default_id: number | null;
    afecta_inventario: AfectaInventario | null;
    afecta_reservado: boolean;
    usar_especificaciones: boolean;
  }>(
    `INSERT INTO core.empresas_tipos_documento (
        empresa_id,
        tipo_documento_id,
        activo,
        whatsapp_plantilla_default_id,
        afecta_inventario,
        afecta_reservado,
        usar_especificaciones
     )
       VALUES ($1, $2, $3, CASE WHEN $4 THEN $5::bigint ELSE NULL::bigint END, $6, $7, CASE WHEN $8 THEN $9 ELSE FALSE END)
   ON CONFLICT (empresa_id, tipo_documento_id)
     DO UPDATE SET
       activo = EXCLUDED.activo,
       whatsapp_plantilla_default_id = CASE
         WHEN $4 THEN EXCLUDED.whatsapp_plantilla_default_id
         ELSE core.empresas_tipos_documento.whatsapp_plantilla_default_id
       END,
       afecta_inventario = EXCLUDED.afecta_inventario,
       afecta_reservado = EXCLUDED.afecta_reservado,
       usar_especificaciones = CASE
         WHEN $8 THEN EXCLUDED.usar_especificaciones
         ELSE core.empresas_tipos_documento.usar_especificaciones
       END
   RETURNING empresa_id, tipo_documento_id, activo, whatsapp_plantilla_default_id, afecta_inventario, afecta_reservado, usar_especificaciones`,
    [empresaId, tipoDocumentoId, activo, includeWhatsappPlantillaDefault, whatsappPlantillaDefaultId, afectaInventario ?? null, afectaReservado, includeUsarEspecificaciones, usarEspecificaciones]
  );

  return rows[0] ?? null;
}

export async function obtenerDocumentosActivosEmpresa(empresaId: number): Promise<DocumentoEmpresa[]> {
  const query = `
    SELECT
      td.id,
      td.codigo,
      td.nombre,
      td.nombre_plural,
      td.icono,
      td.orden,
      TRUE AS habilitado,
      etd.whatsapp_plantilla_default_id
    FROM core.tipos_documento td
    JOIN core.empresas_tipos_documento etd
      ON etd.tipo_documento_id = td.id
     AND etd.empresa_id = $1
    WHERE td.activo = TRUE
      AND etd.activo = TRUE
    ORDER BY td.orden, td.nombre;
  `;

  const { rows } = await pool.query<DocumentoEmpresa>(query, [empresaId]);
  return rows;
}

export async function obtenerTransicionesEmpresa(empresaId: number): Promise<TransicionDocumento[]> {
  const { rows } = await pool.query<TransicionDocumento>(
    `SELECT tipo_documento_origen_id, tipo_documento_destino_id, activo
       FROM core.empresas_tipos_documento_transiciones
      WHERE empresa_id = $1`,
    [empresaId]
  );

  return rows;
}

export async function upsertTransicionDocumento(
  empresaId: number,
  origenId: number,
  destinoId: number,
  activo: boolean
): Promise<TransicionDocumento | null> {
  const { rows } = await pool.query<TransicionDocumento>(
    `INSERT INTO core.empresas_tipos_documento_transiciones (
        empresa_id,
        tipo_documento_origen_id,
        tipo_documento_destino_id,
        activo
     ) VALUES ($1, $2, $3, $4)
     ON CONFLICT (empresa_id, tipo_documento_origen_id, tipo_documento_destino_id)
     DO UPDATE SET activo = EXCLUDED.activo
     RETURNING tipo_documento_origen_id, tipo_documento_destino_id, activo`,
    [empresaId, origenId, destinoId, activo]
  );

  return rows[0] ?? null;
}
