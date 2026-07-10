import pool from '../../config/database';

export interface ConfiguracionContable {
  id: number;
  empresa_id: number;
  caracter_separador: string;
  estructura_cuentas: string;
  permitir_venta_no_timbrada: boolean;
  tipo_poliza_venta_factura_id: number | null;
  tipo_poliza_venta_cancelacion_id: number | null;
  creado_en: string;
  actualizado_en: string;
}

export type ConfiguracionContableInput = {
  estructura_cuentas?: string;
  caracter_separador?: string;
  permitir_venta_no_timbrada?: boolean;
  tipo_poliza_venta_factura_id?: number | null;
  tipo_poliza_venta_cancelacion_id?: number | null;
};

const DEFAULT_ESTRUCTURA_CUENTAS = '3-4-3';
const DEFAULT_CARACTER_SEPARADOR = '-';
const ESTRUCTURA_CUENTAS_REGEX = /^\d+(-\d+){1,5}$/;

// contabilidad.configuracion.id/empresa_id/tipo_poliza_*_id son bigint: node-pg
// los regresa como string. Se normalizan a number para que TS y el resto del
// código (comparaciones, resolverTipoPolizaVenta) no se topen con un string
// donde se espera un number.
function mapearConfiguracion(row: any): ConfiguracionContable {
  return {
    ...row,
    id: Number(row.id),
    empresa_id: Number(row.empresa_id),
    tipo_poliza_venta_factura_id:
      row.tipo_poliza_venta_factura_id != null ? Number(row.tipo_poliza_venta_factura_id) : null,
    tipo_poliza_venta_cancelacion_id:
      row.tipo_poliza_venta_cancelacion_id != null ? Number(row.tipo_poliza_venta_cancelacion_id) : null,
  };
}

export async function obtenerOCrearConfiguracion(empresaId: number): Promise<ConfiguracionContable> {
  const { rows } = await pool.query(`SELECT * FROM contabilidad.configuracion WHERE empresa_id = $1`, [empresaId]);
  if (rows[0]) return mapearConfiguracion(rows[0]);

  const { rows: creadas } = await pool.query(
    `INSERT INTO contabilidad.configuracion (empresa_id, caracter_separador, estructura_cuentas)
     VALUES ($1, $2, $3)
     ON CONFLICT (empresa_id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id
     RETURNING *`,
    [empresaId, DEFAULT_CARACTER_SEPARADOR, DEFAULT_ESTRUCTURA_CUENTAS]
  );
  return mapearConfiguracion(creadas[0]);
}

async function validarTipoPolizaOpcional(empresaId: number, tipoPolizaId: number, etiqueta: string): Promise<void> {
  const { rows } = await pool.query<{ existe: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM contabilidad.tipos_poliza WHERE id = $1 AND empresa_id = $2 AND activo = true
     ) AS existe`,
    [tipoPolizaId, empresaId]
  );
  if (!rows[0].existe) {
    throw new Error(`VALIDATION_ERROR: El tipo de póliza seleccionado para ${etiqueta} no existe o no está activo.`);
  }
}

export async function actualizarConfiguracion(
  empresaId: number,
  input: ConfiguracionContableInput
): Promise<ConfiguracionContable> {
  // Distintas secciones de la UI (Estructura de cuentas, Tipos automáticos)
  // hacen PUT parcial sobre el mismo registro: cualquier campo que no venga
  // en el input conserva su valor actual, nunca un default fijo, o guardar
  // "Tipos automáticos" resetearía la estructura de cuentas ya configurada.
  const actual = await obtenerOCrearConfiguracion(empresaId);

  const estructuraCuentas = input.estructura_cuentas?.trim() || actual.estructura_cuentas;
  const caracterSeparador = input.caracter_separador ?? actual.caracter_separador;

  if (!ESTRUCTURA_CUENTAS_REGEX.test(estructuraCuentas)) {
    throw new Error(
      'VALIDATION_ERROR: La estructura de cuentas debe expresarse como longitudes separadas por guion, por ejemplo 3-4-3'
    );
  }
  const separadorValido = caracterSeparador.length === 1;
  if (!separadorValido) {
    throw new Error('VALIDATION_ERROR: El carácter separador debe ser exactamente un carácter');
  }

  const permitirVentaNoTimbrada = input.permitir_venta_no_timbrada ?? actual.permitir_venta_no_timbrada;

  const tipoPolizaVentaFacturaId =
    input.tipo_poliza_venta_factura_id !== undefined
      ? input.tipo_poliza_venta_factura_id
      : actual.tipo_poliza_venta_factura_id;
  const tipoPolizaVentaCancelacionId =
    input.tipo_poliza_venta_cancelacion_id !== undefined
      ? input.tipo_poliza_venta_cancelacion_id
      : actual.tipo_poliza_venta_cancelacion_id;

  if (tipoPolizaVentaFacturaId != null) {
    await validarTipoPolizaOpcional(empresaId, tipoPolizaVentaFacturaId, 'facturas de venta');
  }
  if (tipoPolizaVentaCancelacionId != null) {
    await validarTipoPolizaOpcional(empresaId, tipoPolizaVentaCancelacionId, 'cancelaciones de factura de venta');
  }

  const { rows } = await pool.query(
    `UPDATE contabilidad.configuracion
       SET estructura_cuentas = $1, caracter_separador = $2, permitir_venta_no_timbrada = $3,
           tipo_poliza_venta_factura_id = $4, tipo_poliza_venta_cancelacion_id = $5, actualizado_en = now()
     WHERE empresa_id = $6
     RETURNING *`,
    [
      estructuraCuentas,
      caracterSeparador,
      permitirVentaNoTimbrada,
      tipoPolizaVentaFacturaId,
      tipoPolizaVentaCancelacionId,
      empresaId,
    ]
  );
  return mapearConfiguracion(rows[0]);
}
