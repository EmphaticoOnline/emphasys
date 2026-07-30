import type { PoolClient } from 'pg';

export type TipoRelacionDocumento =
  | 'derivacion_operativa'
  | 'regeneracion'
  | 'correccion'
  | 'sustitucion_fiscal'
  | 'duplicacion'
  | 'referencia_interna';

export type DependenciaCancelacion = {
  relacion: 'documento_origen_id' | 'vinculo_partidas';
  documentoId: number;
  tipoDocumento: string;
  folio: string;
  estatus: string | null;
  tipoRelacion: TipoRelacionDocumento | 'desconocida';
  bloqueaCancelacion: boolean;
};

type DependenciaRow = {
  relacion: DependenciaCancelacion['relacion'];
  documento_id: number;
  tipo_documento: string;
  folio: string;
  estatus_documento: string | null;
  tipo_relacion: TipoRelacionDocumento | null;
  bloquea_cancelacion: boolean | null;
};

export function clasificarDependenciasCancelacion(
  rows: readonly DependenciaRow[]
): { bloqueantes: DependenciaCancelacion[]; noBloqueantes: DependenciaCancelacion[] } {
  const unique = new Map<string, DependenciaCancelacion>();
  for (const row of rows) {
    const status = String(row.estatus_documento ?? '').trim().toLowerCase();
    if (status === 'cancelado' || status === 'cancelada') continue;
    const key = `${row.relacion}:${row.documento_id}`;
    const explicit = Boolean(row.tipo_relacion) && row.bloquea_cancelacion !== null;
    const dependency: DependenciaCancelacion = {
      relacion: row.relacion,
      documentoId: Number(row.documento_id),
      tipoDocumento: row.tipo_documento,
      folio: row.folio,
      estatus: row.estatus_documento,
      tipoRelacion: explicit ? row.tipo_relacion! : 'desconocida',
      // Una relación sin clasificación sigue bloqueando por seguridad.
      bloqueaCancelacion: explicit ? Boolean(row.bloquea_cancelacion) : true,
    };
    unique.set(key, dependency);
  }
  const dependencies = [...unique.values()];
  return {
    bloqueantes: dependencies.filter((item) => item.bloqueaCancelacion),
    noBloqueantes: dependencies.filter((item) => !item.bloqueaCancelacion),
  };
}

export async function obtenerDependenciasCancelacion(
  client: PoolClient,
  documentoId: number,
  empresaId: number
) {
  const { rows } = await client.query<DependenciaRow>(
    `WITH dependencias AS (
       SELECT 'documento_origen_id'::text AS relacion,
              d.id AS documento_id, d.tipo_documento,
              CONCAT_WS('-', NULLIF(d.serie, ''), LPAD(d.numero::text, CASE WHEN ABS(d.numero) < 1000 THEN 3 ELSE 6 END, '0')) AS folio,
              d.estatus_documento
         FROM documentos d
        WHERE d.empresa_id = $1
          AND d.documento_origen_id = $2
          AND LOWER(TRIM(COALESCE(d.estatus_documento, ''))) NOT IN ('cancelado', 'cancelada')
       UNION ALL
       SELECT 'vinculo_partidas'::text AS relacion,
              d.id AS documento_id, d.tipo_documento,
              CONCAT_WS('-', NULLIF(d.serie, ''), LPAD(d.numero::text, CASE WHEN ABS(d.numero) < 1000 THEN 3 ELSE 6 END, '0')) AS folio,
              d.estatus_documento
         FROM documentos_partidas_vinculos dpv
         JOIN documentos d ON d.id = dpv.documento_destino_id
        WHERE dpv.documento_origen_id = $2
          AND d.empresa_id = $1
          AND d.id <> $2
          AND LOWER(TRIM(COALESCE(d.estatus_documento, ''))) NOT IN ('cancelado', 'cancelada')
     )
     SELECT dep.relacion, dep.documento_id, dep.tipo_documento, dep.folio,
            dep.estatus_documento, rel.tipo_relacion, rel.bloquea_cancelacion
       FROM dependencias dep
       LEFT JOIN documentos_relaciones rel
         ON rel.empresa_id = $1
        AND rel.documento_origen_id = $2
        AND rel.documento_destino_id = dep.documento_id
        AND rel.activa = true
      ORDER BY dep.documento_id`,
    [empresaId, documentoId]
  );
  return clasificarDependenciasCancelacion(rows);
}

export async function registrarRelacionDocumento(
  client: PoolClient,
  input: {
    empresaId: number;
    documentoOrigenId: number;
    documentoDestinoId: number;
    tipoRelacion: TipoRelacionDocumento;
    bloqueaCancelacion: boolean;
    usuarioId?: number | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO documentos_relaciones (
       empresa_id, documento_origen_id, documento_destino_id,
       tipo_relacion, bloquea_cancelacion, usuario_creacion_id, metadata
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (empresa_id, documento_origen_id, documento_destino_id)
     DO UPDATE SET
       tipo_relacion = EXCLUDED.tipo_relacion,
       bloquea_cancelacion = EXCLUDED.bloquea_cancelacion,
       metadata = EXCLUDED.metadata,
       activa = true,
       fecha_modificacion = now()`,
    [
      input.empresaId,
      input.documentoOrigenId,
      input.documentoDestinoId,
      input.tipoRelacion,
      input.bloqueaCancelacion,
      input.usuarioId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
}
