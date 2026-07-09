import pool from '../../config/database';

// Catálogo oficial de códigos agrupadores SAT (Anexo 24). Vive en el
// esquema `sat` (igual que regímenes fiscales, formas de pago, etc.), pero
// se consulta/valida desde el módulo de contabilidad porque es aquí donde
// se usa: en el formulario de cuentas y en el validador de e-contabilidad.

export interface CodigoAgrupadorSat {
  id: number;
  codigo: string;
  descripcion: string;
  nivel: number | null;
  naturaleza: string | null;
  activo: boolean;
}

function mapear(row: any): CodigoAgrupadorSat {
  return {
    id: Number(row.id),
    codigo: row.codigo,
    descripcion: row.descripcion,
    nivel: row.nivel != null ? Number(row.nivel) : null,
    naturaleza: row.naturaleza,
    activo: row.activo,
  };
}

// Solo códigos activos: son los únicos que deben ofrecerse para captura
// nueva. Un código dado de baja no aparece aquí pero sigue existiendo en
// la tabla (ver validarCodigoAgrupadorSat) para no romper histórico.
//
// Sin límite artificial: el catálogo completo son ~1,076 códigos (Anexo 24),
// un volumen chico y acotado por naturaleza (no crece por transacción, solo
// por actualización periódica del propio SAT). El frontend carga esta lista
// UNA vez (sin `buscar`) y filtra en el Autocomplete localmente — un LIMIT
// aquí cortaría el catálogo a la mitad en orden alfabético de código y
// dejaría códigos completos (ej. toda la familia "603.x") inalcanzables sin
// que el usuario lo note, que es justo el bug que esto corrige. `buscar`
// se conserva para quien prefiera consultar por texto en vez de cargar todo.
export async function listarCodigosAgrupadores(buscar?: string): Promise<CodigoAgrupadorSat[]> {
  const condiciones = ['activo = true'];
  const params: string[] = [];
  if (buscar?.trim()) {
    params.push(`%${buscar.trim()}%`);
    condiciones.push(`(codigo ILIKE $${params.length} OR descripcion ILIKE $${params.length})`);
  }
  const { rows } = await pool.query(
    `SELECT id, codigo, descripcion, nivel, naturaleza, activo
     FROM sat.codigos_agrupadores
     WHERE ${condiciones.join(' AND ')}
     ORDER BY codigo`,
    params
  );
  return rows.map(mapear);
}

export async function obtenerCodigoAgrupadorPorCodigo(codigo: string): Promise<CodigoAgrupadorSat | null> {
  const { rows } = await pool.query(
    `SELECT id, codigo, descripcion, nivel, naturaleza, activo
     FROM sat.codigos_agrupadores
     WHERE codigo = $1`,
    [codigo]
  );
  return rows[0] ? mapear(rows[0]) : null;
}

export async function contarCodigosAgrupadoresActivos(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM sat.codigos_agrupadores WHERE activo = true`
  );
  return Number(rows[0]?.count ?? 0);
}

// Mapa código -> activo, incluyendo INACTIVOS (a diferencia de
// listarCodigosAgrupadores, que solo trae activos). El generador del XML de
// catálogo de cuentas necesita distinguir "código inexistente" de "código
// existente pero dado de baja" para reportar el error correcto.
export async function obtenerMapaCodigosAgrupadores(): Promise<Map<string, boolean>> {
  const { rows } = await pool.query<{ codigo: string; activo: boolean }>(
    `SELECT codigo, activo FROM sat.codigos_agrupadores`
  );
  return new Map(rows.map((r) => [r.codigo, r.activo]));
}

// Usada al crear/editar una cuenta contable. No valida vacío (eso lo
// decide el llamador: dejar el campo vacío siempre está permitido).
export async function validarCodigoAgrupadorSat(codigo: string): Promise<void> {
  const encontrado = await obtenerCodigoAgrupadorPorCodigo(codigo);
  if (!encontrado || !encontrado.activo) {
    throw new Error('VALIDATION_ERROR: El código agrupador SAT no existe en el catálogo oficial.');
  }
}
