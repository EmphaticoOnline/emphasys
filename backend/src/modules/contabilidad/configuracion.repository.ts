import pool from '../../config/database';

export interface ConfiguracionContable {
  id: number;
  empresa_id: number;
  caracter_separador: string;
  estructura_cuentas: string;
  creado_en: string;
  actualizado_en: string;
}

export type ConfiguracionContableInput = {
  estructura_cuentas?: string;
  caracter_separador?: string;
};

const DEFAULT_ESTRUCTURA_CUENTAS = '3-4-3';
const DEFAULT_CARACTER_SEPARADOR = '-';
const ESTRUCTURA_CUENTAS_REGEX = /^\d+(-\d+){1,5}$/;

export async function obtenerOCrearConfiguracion(empresaId: number): Promise<ConfiguracionContable> {
  const { rows } = await pool.query<ConfiguracionContable>(
    `SELECT * FROM contabilidad.configuracion WHERE empresa_id = $1`,
    [empresaId]
  );
  if (rows[0]) return rows[0];

  const { rows: creadas } = await pool.query<ConfiguracionContable>(
    `INSERT INTO contabilidad.configuracion (empresa_id, caracter_separador, estructura_cuentas)
     VALUES ($1, $2, $3)
     ON CONFLICT (empresa_id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id
     RETURNING *`,
    [empresaId, DEFAULT_CARACTER_SEPARADOR, DEFAULT_ESTRUCTURA_CUENTAS]
  );
  return creadas[0];
}

export async function actualizarConfiguracion(
  empresaId: number,
  input: ConfiguracionContableInput
): Promise<ConfiguracionContable> {
  const estructuraCuentas = input.estructura_cuentas?.trim() || DEFAULT_ESTRUCTURA_CUENTAS;
  const caracterSeparador = input.caracter_separador ?? DEFAULT_CARACTER_SEPARADOR;

  if (!ESTRUCTURA_CUENTAS_REGEX.test(estructuraCuentas)) {
    throw new Error(
      'VALIDATION_ERROR: La estructura de cuentas debe expresarse como longitudes separadas por guion, por ejemplo 3-4-3'
    );
  }
  const separadorValido = caracterSeparador.length === 1;
  if (!separadorValido) {
    throw new Error('VALIDATION_ERROR: El carácter separador debe ser exactamente un carácter');
  }

  await obtenerOCrearConfiguracion(empresaId);

  const { rows } = await pool.query<ConfiguracionContable>(
    `UPDATE contabilidad.configuracion
       SET estructura_cuentas = $1, caracter_separador = $2, actualizado_en = now()
     WHERE empresa_id = $3
     RETURNING *`,
    [estructuraCuentas, caracterSeparador, empresaId]
  );
  return rows[0];
}
