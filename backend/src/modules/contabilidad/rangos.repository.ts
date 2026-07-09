import pool from '../../config/database';

export interface RangoCuenta {
  empresa_id: number;
  id: number;
  limite_superior: number;
  naturaleza_saldo: string;
  descripcion: string;
  rango: string | null;
  grupo: string | null;
  subgrupo: string | null;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export type RangoCuentaNuevoInput = {
  limite_superior: number;
  naturaleza_saldo: string;
  descripcion: string;
  grupo: string;
  subgrupo?: string | null;
  activo?: boolean;
};

export type RangoCuentaEdicionInput = {
  limite_superior: number;
  naturaleza_saldo: string;
  descripcion: string;
  grupo: string;
  subgrupo?: string | null;
  activo?: boolean;
};

export const GRUPOS_RANGO_CUENTA = [
  'Activo Circulante',
  'Activo Fijo',
  'Activo Diferido',
  'Pasivo Corto Plazo',
  'Pasivo Largo Plazo',
  'Pasivo Diferido',
  'Capital Contable',
  'Ingresos',
  'Egresos',
  'Orden',
];

const GRUPOS_DE_RESULTADOS = ['Ingresos', 'Egresos'];

export const SUBGRUPOS_RESULTADOS = [
  'Ventas',
  'Rebajas, Bonificaciones y Dev. sobre Vtas',
  'Costo de Ventas',
  'Gastos de Administración',
  'Gastos de Venta',
  'Gastos Financieros',
  'Impuestos',
];

export const SUBGRUPOS_NO_RESULTADOS = ['Sistema Financiero', 'Otros Créditos/Deudas', 'Ninguno'];

export function subgruposValidosParaGrupo(grupo: string): string[] {
  return GRUPOS_DE_RESULTADOS.includes(grupo) ? SUBGRUPOS_RESULTADOS : SUBGRUPOS_NO_RESULTADOS;
}

function validarCamposComunes(input: { naturaleza_saldo: string; descripcion: string; grupo: string; subgrupo?: string | null }) {
  if (input.naturaleza_saldo !== 'D' && input.naturaleza_saldo !== 'A') {
    throw new Error('VALIDATION_ERROR: La naturaleza del saldo debe ser Deudora (D) o Acreedora (A)');
  }
  if (!input.descripcion?.trim()) {
    throw new Error('VALIDATION_ERROR: La descripción es requerida');
  }
  if (!input.grupo || !GRUPOS_RANGO_CUENTA.includes(input.grupo)) {
    throw new Error('VALIDATION_ERROR: El grupo no es válido');
  }
  const subgrupo = input.subgrupo?.trim() || null;
  if (subgrupo && !subgruposValidosParaGrupo(input.grupo).includes(subgrupo)) {
    throw new Error(`VALIDATION_ERROR: El subgrupo seleccionado no es válido para el grupo "${input.grupo}"`);
  }
}

export async function listarRangosCuentas(empresaId: number): Promise<RangoCuenta[]> {
  const { rows } = await pool.query<RangoCuenta>(
    `SELECT * FROM contabilidad.rangos_cuentas WHERE empresa_id = $1 ORDER BY limite_superior`,
    [empresaId]
  );
  return rows;
}

export async function obtenerRangoCuentaPorId(id: number, empresaId: number): Promise<RangoCuenta | null> {
  const { rows } = await pool.query<RangoCuenta>(
    `SELECT * FROM contabilidad.rangos_cuentas WHERE empresa_id = $1 AND id = $2`,
    [empresaId, id]
  );
  return rows[0] ?? null;
}

async function obtenerRangoCuentaPorLimiteSuperior(
  limiteSuperior: number,
  empresaId: number,
  excluirId?: number
): Promise<RangoCuenta | null> {
  const condiciones = ['empresa_id = $1', 'limite_superior = $2'];
  const params: Array<number> = [empresaId, limiteSuperior];
  if (excluirId != null) {
    params.push(excluirId);
    condiciones.push(`id <> $${params.length}`);
  }
  const { rows } = await pool.query<RangoCuenta>(
    `SELECT * FROM contabilidad.rangos_cuentas WHERE ${condiciones.join(' AND ')}`,
    params
  );
  return rows[0] ?? null;
}

export async function crearRangoCuenta(empresaId: number, input: RangoCuentaNuevoInput): Promise<RangoCuenta> {
  if (!Number.isInteger(input.limite_superior) || input.limite_superior <= 0) {
    throw new Error('VALIDATION_ERROR: El límite superior debe ser un número entero positivo');
  }
  validarCamposComunes(input);

  const existente = await obtenerRangoCuentaPorLimiteSuperior(input.limite_superior, empresaId);
  if (existente) {
    throw new Error('VALIDATION_ERROR: Ya existe un rango con ese límite superior en esta empresa');
  }

  const { rows } = await pool.query<RangoCuenta>(
    `INSERT INTO contabilidad.rangos_cuentas (empresa_id, limite_superior, naturaleza_saldo, descripcion, grupo, subgrupo, activo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      empresaId,
      input.limite_superior,
      input.naturaleza_saldo,
      input.descripcion.trim(),
      input.grupo,
      input.subgrupo?.trim() || null,
      input.activo ?? true,
    ]
  );
  return rows[0];
}

export async function actualizarRangoCuenta(
  id: number,
  empresaId: number,
  input: RangoCuentaEdicionInput
): Promise<RangoCuenta | null> {
  const actual = await obtenerRangoCuentaPorId(id, empresaId);
  if (!actual) return null;

  if (!Number.isInteger(input.limite_superior) || input.limite_superior <= 0) {
    throw new Error('VALIDATION_ERROR: El límite superior debe ser un número entero positivo');
  }
  validarCamposComunes(input);

  if (input.limite_superior !== actual.limite_superior) {
    const duplicado = await obtenerRangoCuentaPorLimiteSuperior(input.limite_superior, empresaId, id);
    if (duplicado) {
      throw new Error('VALIDATION_ERROR: Ya existe un rango con ese límite superior en esta empresa');
    }
  }

  const { rows } = await pool.query<RangoCuenta>(
    `UPDATE contabilidad.rangos_cuentas
       SET limite_superior = $1, naturaleza_saldo = $2, descripcion = $3, grupo = $4, subgrupo = $5, activo = $6, actualizado_en = now()
     WHERE empresa_id = $7 AND id = $8
     RETURNING *`,
    [
      input.limite_superior,
      input.naturaleza_saldo,
      input.descripcion.trim(),
      input.grupo,
      input.subgrupo?.trim() || null,
      input.activo ?? actual.activo,
      empresaId,
      id,
    ]
  );
  return rows[0];
}

// Eliminación física: solo procede si ninguna cuenta contable usa este rango
// por su llave técnica (rango_cuenta_id -> rangos_cuentas.id), nunca por
// limite_superior.
export async function eliminarRangoCuenta(id: number, empresaId: number): Promise<boolean | null> {
  const actual = await obtenerRangoCuentaPorId(id, empresaId);
  if (!actual) return null;

  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM contabilidad.cuentas WHERE empresa_id = $1 AND rango_cuenta_id = $2`,
    [empresaId, id]
  );
  if (Number(rows[0].count) > 0) {
    throw new Error('VALIDATION_ERROR: No se puede eliminar el rango porque ya está asignado a cuentas contables.');
  }

  await pool.query(`DELETE FROM contabilidad.rangos_cuentas WHERE empresa_id = $1 AND id = $2`, [empresaId, id]);
  return true;
}
