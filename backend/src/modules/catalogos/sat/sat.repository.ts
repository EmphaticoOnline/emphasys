import pool from "../../../config/database";

export type SatClaveNombre = {
  clave: string;
  nombre: string;
};

export type RegimenFiscal = {
  id: string;
  descripcion: string;
};

export type CodigoPostalResultado = {
  codigo_postal: string;
  estado: SatClaveNombre;
  municipio: SatClaveNombre;
  localidad: SatClaveNombre;
  pais: SatClaveNombre;
  colonias: SatClaveNombre[];
};

const QUERY_CP = `
SELECT
  cp.id AS codigo_postal,

  cp.estado,
  e.texto AS estado_nombre,

  cp.municipio,
  m.texto AS municipio_nombre,

  cp.localidad,
  l.texto AS localidad_nombre,

  p.id AS pais,
  p.texto AS pais_nombre

FROM sat.codigos_postales cp

JOIN sat.estados e
  ON e.estado = cp.estado

JOIN sat.municipios m
  ON m.municipio = cp.municipio
 AND m.estado = cp.estado

LEFT JOIN sat.localidades l
  ON l.localidad = cp.localidad
 AND l.estado = cp.estado

JOIN sat.paises p
  ON p.id = e.pais

WHERE cp.id = $1
LIMIT 1;
`;

const QUERY_COLONIAS = `
SELECT
    colonia,
    texto
FROM sat.colonias
WHERE codigo_postal = $1
  AND ($2::text IS NULL OR texto ILIKE $2 || '%')
ORDER BY texto
LIMIT $3;
`;

const QUERY_BUSCAR_CP = `
SELECT
    id,
    estado,
    municipio
FROM sat.codigos_postales
WHERE id ILIKE $1 || '%'
ORDER BY id
LIMIT $2;
`;

const QUERY_CREATE_INDEX_COLONIAS = `
CREATE INDEX IF NOT EXISTS idx_colonias_cp_texto
ON sat.colonias (codigo_postal, texto);
`;

const QUERY_REGIMENES = `
SELECT
  id,
  texto
FROM sat.regimenes_fiscales
WHERE ($1::text IS NULL OR texto ILIKE '%' || $1 || '%' OR id ILIKE '%' || $1 || '%')
ORDER BY id
LIMIT $2;
`;

const QUERY_USOS_CFDI = `
SELECT
    id,
    texto
FROM sat.usos_cfdi
WHERE ($1::text IS NULL OR texto ILIKE '%' || $1 || '%' OR id ILIKE '%' || $1 || '%')
ORDER BY texto
LIMIT $2;
`;

const QUERY_FORMAS_PAGO = `
SELECT
    id,
    texto
FROM sat.formas_pago
WHERE ($1::text IS NULL OR texto ILIKE '%' || $1 || '%' OR id ILIKE '%' || $1 || '%')
ORDER BY texto
LIMIT $2;
`;

const QUERY_METODOS_PAGO = `
SELECT
    id,
    texto
FROM sat.metodos_pago
WHERE ($1::text IS NULL OR texto ILIKE '%' || $1 || '%' OR id ILIKE '%' || $1 || '%')
ORDER BY texto
LIMIT $2;
`;

const sanitizeLimit = (limit: number | undefined, fallback = 20, max = 50) => {
  if (!limit || Number.isNaN(Number(limit))) return fallback;
  const parsed = Number(limit);
  if (parsed <= 0) return fallback;
  return parsed > max ? max : parsed;
};

let coloniasIndexEnsured = false;
async function ensureColoniasIndex() {
  if (coloniasIndexEnsured) return;
  try {
    await pool.query(QUERY_CREATE_INDEX_COLONIAS);
    coloniasIndexEnsured = true;
  } catch (err) {
    console.error("No se pudo crear/validar índice de colonias:", err);
    // no interrumpir flujo; se seguirá ejecutando sin índice
  }
}

export async function buscarCodigoPostal(cp: string): Promise<CodigoPostalResultado | null> {
  const { rows } = await pool.query(QUERY_CP, [cp]);
  const row = rows[0];
  if (!row) return null;

  const colonias = await listarColoniasPorCp(cp);

  return {
    codigo_postal: row.codigo_postal,
    estado: { clave: row.estado, nombre: row.estado_nombre },
    municipio: { clave: row.municipio, nombre: row.municipio_nombre },
    localidad: { clave: row.localidad, nombre: row.localidad_nombre || row.localidad },
    pais: { clave: row.pais, nombre: row.pais_nombre },
    colonias,
  };
}

export async function listarColoniasPorCp(cp: string, q?: string | null, limit = 100): Promise<SatClaveNombre[]> {
  await ensureColoniasIndex();
  const safeLimit = sanitizeLimit(limit, 100, 200);
  const { rows } = await pool.query(QUERY_COLONIAS, [cp, q ?? null, safeLimit]);
  return rows.map((row: any) => ({ clave: row.colonia, nombre: row.texto }));
}

export async function buscarRegimenesFiscales(q: string | null, limit?: number): Promise<RegimenFiscal[]> {
  const safeLimit = sanitizeLimit(limit);
  const { rows } = await pool.query(QUERY_REGIMENES, [q ?? null, safeLimit]);
  return rows.map((row: any) => ({ id: String(row.id), descripcion: row.texto }));
}

export async function buscarUsosCfdi(q: string | null, limit?: number): Promise<SatClaveNombre[]> {
  const safeLimit = sanitizeLimit(limit);
  const { rows } = await pool.query(QUERY_USOS_CFDI, [q ?? null, safeLimit]);
  return rows.map((row: any) => ({ clave: row.id, nombre: row.texto }));
}

export async function buscarFormasPago(q: string | null, limit?: number): Promise<SatClaveNombre[]> {
  const safeLimit = sanitizeLimit(limit);
  const { rows } = await pool.query(QUERY_FORMAS_PAGO, [q ?? null, safeLimit]);
  return rows.map((row: any) => ({ clave: row.id, nombre: row.texto }));
}

export async function buscarMetodosPago(q: string | null, limit?: number): Promise<SatClaveNombre[]> {
  const safeLimit = sanitizeLimit(limit);
  const { rows } = await pool.query(QUERY_METODOS_PAGO, [q ?? null, safeLimit]);
  return rows.map((row: any) => ({ clave: row.id, nombre: row.texto }));
}

export async function buscarCodigosPostales(q: string | null, limit?: number) {
  const safeLimit = sanitizeLimit(limit);
  const search = q ? q : "";
  const { rows } = await pool.query(QUERY_BUSCAR_CP, [search, safeLimit]);
  return rows.map((row: any) => ({
    codigo_postal: row.id,
    estado: row.estado,
    municipio: row.municipio,
  }));
}
