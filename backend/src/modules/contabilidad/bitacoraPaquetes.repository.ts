import pool from '../../config/database';

// ---------------------------------------------------------------------------
// Fase 12 de Contabilidad Electrónica: bitácora interna de paquetes ZIP
// generados (Fase 11). Solo trazabilidad -- nunca se guarda el ZIP ni los
// XML binarios, solo metadatos (parámetros, archivos incluidos, resumen y
// hash del ZIP).
// ---------------------------------------------------------------------------

export interface RegistrarPaqueteInput {
  empresaId: number;
  ejercicio: number;
  periodo: number;
  nombreZip: string;
  archivosIncluidos: unknown;
  parametros: unknown;
  resumen: unknown;
  hashZip: string;
  generadoPor: number | null;
}

export async function registrarPaqueteGenerado(input: RegistrarPaqueteInput): Promise<void> {
  await pool.query(
    `INSERT INTO contabilidad.e_contabilidad_paquetes
       (empresa_id, ejercicio, periodo, nombre_zip, archivos_incluidos, parametros, resumen, hash_zip, hash_algoritmo, generado_por)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, 'SHA-256', $9)`,
    [
      input.empresaId,
      input.ejercicio,
      input.periodo,
      input.nombreZip,
      JSON.stringify(input.archivosIncluidos),
      JSON.stringify(input.parametros),
      JSON.stringify(input.resumen),
      input.hashZip,
      input.generadoPor,
    ]
  );
}

export interface ItemBitacoraPaquete {
  id: number;
  ejercicio: number;
  periodo: number;
  nombre_zip: string;
  archivos_incluidos: unknown;
  parametros: unknown;
  resumen: unknown;
  hash_zip: string | null;
  hash_algoritmo: string | null;
  generado_por: number | null;
  generado_por_nombre: string | null;
  generado_en: string;
  observaciones: string | null;
}

export interface FiltrosBitacoraPaquetes {
  ejercicio?: number;
  periodo?: number;
  buscar?: string;
  limite: number;
}

export async function listarBitacoraPaquetes(empresaId: number, filtros: FiltrosBitacoraPaquetes): Promise<ItemBitacoraPaquete[]> {
  const condiciones = ['ep.empresa_id = $1'];
  const params: (string | number)[] = [empresaId];

  if (filtros.ejercicio != null) {
    params.push(filtros.ejercicio);
    condiciones.push(`ep.ejercicio = $${params.length}`);
  }
  if (filtros.periodo != null) {
    params.push(filtros.periodo);
    condiciones.push(`ep.periodo = $${params.length}`);
  }
  if (filtros.buscar?.trim()) {
    params.push(`%${filtros.buscar.trim()}%`);
    condiciones.push(`(ep.nombre_zip ILIKE $${params.length} OR ep.hash_zip ILIKE $${params.length})`);
  }
  params.push(filtros.limite);

  const { rows } = await pool.query(
    `SELECT ep.id, ep.ejercicio, ep.periodo, ep.nombre_zip, ep.archivos_incluidos, ep.parametros, ep.resumen,
       ep.hash_zip, ep.hash_algoritmo, ep.generado_por, u.nombre AS generado_por_nombre,
       to_char(ep.generado_en, 'YYYY-MM-DD"T"HH24:MI:SS') AS generado_en, ep.observaciones
     FROM contabilidad.e_contabilidad_paquetes ep
     LEFT JOIN core.usuarios u ON u.id = ep.generado_por
     WHERE ${condiciones.join(' AND ')}
     ORDER BY ep.generado_en DESC
     LIMIT $${params.length}`,
    params
  );

  return rows.map((r) => ({
    id: Number(r.id),
    ejercicio: Number(r.ejercicio),
    periodo: Number(r.periodo),
    nombre_zip: r.nombre_zip,
    archivos_incluidos: r.archivos_incluidos,
    parametros: r.parametros,
    resumen: r.resumen,
    hash_zip: r.hash_zip ?? null,
    hash_algoritmo: r.hash_algoritmo ?? null,
    generado_por: r.generado_por != null ? Number(r.generado_por) : null,
    generado_por_nombre: r.generado_por_nombre ?? null,
    generado_en: r.generado_en,
    observaciones: r.observaciones ?? null,
  }));
}
