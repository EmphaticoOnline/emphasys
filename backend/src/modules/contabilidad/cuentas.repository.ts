import pool from '../../config/database';
import { obtenerOCrearConfiguracion } from './configuracion.repository';

export interface Cuenta {
  id: number;
  empresa_id: number;
  cuenta: string;
  descripcion: string;
  rango_cuenta_id: number | null;
  afectable: boolean;
  cuenta_padre_id: number | null;
  nivel: number;
  subgrupo: string | null;
  codigo_agrupador_sat: string | null;
  rubro_presupuesto: string | null;
  no_considerar_presupuesto: boolean;
  observaciones: string | null;
  activa: boolean;
  creado_en: string;
  actualizado_en: string;
}

export type CuentaEdicionInput = {
  descripcion: string;
  afectable?: boolean;
  rango_cuenta_id?: number | null;
  subgrupo?: string | null;
  codigo_agrupador_sat?: string | null;
  rubro_presupuesto?: string | null;
  no_considerar_presupuesto?: boolean;
  observaciones?: string | null;
};

export type CuentaNuevaInput = {
  cuenta: string;
  descripcion: string;
  afectable?: boolean;
  rango_cuenta_id?: number | null;
  subgrupo?: string | null;
  codigo_agrupador_sat?: string | null;
  rubro_presupuesto?: string | null;
  no_considerar_presupuesto?: boolean;
  observaciones?: string | null;
  activa?: boolean;
  // Descripciones para las cuentas ancestro que no existen todavía (todas
  // menos la cuenta final, que usa el campo `descripcion` de arriba).
  descripciones_faltantes?: Record<string, string>;
};

export interface NivelCuentaInfo {
  cuenta: string;
  nivel: number;
  existe: boolean;
  id: number | null;
  requiere_descripcion: boolean;
  es_cuenta_final: boolean;
}

export async function listarCuentas(empresaId: number, opts: { incluirInactivas?: boolean } = {}): Promise<Cuenta[]> {
  const condiciones = ['empresa_id = $1'];
  if (!opts.incluirInactivas) condiciones.push('activa = true');
  const { rows } = await pool.query<Cuenta>(
    `SELECT * FROM contabilidad.cuentas WHERE ${condiciones.join(' AND ')} ORDER BY cuenta`,
    [empresaId]
  );
  return rows;
}

export async function obtenerCuentaPorId(id: number, empresaId: number): Promise<Cuenta | null> {
  const { rows } = await pool.query<Cuenta>(
    `SELECT * FROM contabilidad.cuentas WHERE id = $1 AND empresa_id = $2`,
    [id, empresaId]
  );
  return rows[0] ?? null;
}

async function tieneHijos(cuentaId: number, empresaId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM contabilidad.cuentas WHERE cuenta_padre_id = $1 AND empresa_id = $2 LIMIT 1`,
    [cuentaId, empresaId]
  );
  return rows.length > 0;
}

async function degradarPadreSiAfectable(client: import('pg').PoolClient, cuentaPadreId: number, empresaId: number): Promise<void> {
  await client.query(
    `UPDATE contabilidad.cuentas SET afectable = false, actualizado_en = now()
     WHERE id = $1 AND empresa_id = $2 AND afectable = true`,
    [cuentaPadreId, empresaId]
  );
}

async function listarCuentasPorCodigos(empresaId: number, codigos: string[]): Promise<Map<string, Cuenta>> {
  if (codigos.length === 0) return new Map();
  const { rows } = await pool.query<Cuenta>(
    `SELECT * FROM contabilidad.cuentas WHERE empresa_id = $1 AND cuenta = ANY($2::varchar[])`,
    [empresaId, codigos]
  );
  const map = new Map<string, Cuenta>();
  rows.forEach((row) => map.set(row.cuenta, row));
  return map;
}

// estructura_cuentas siempre usa guion como notación propia de longitudes de
// segmento (ej. "3-4-3"), independientemente del caracter_separador
// configurado para el número de cuenta visible.
function parseEstructuraCuentas(estructuraCuentas: string): number[] {
  const segmentos = estructuraCuentas.split('-').map(Number);
  if (segmentos.length === 0 || segmentos.some((n) => !Number.isInteger(n) || n <= 0)) {
    throw new Error('VALIDATION_ERROR: La configuración de estructura de cuentas es inválida');
  }
  return segmentos;
}

// El usuario captura solo dígitos corridos (o pega una cuenta ya separada);
// aquí se descarta cualquier carácter que no sea dígito, incluyendo el propio
// caracter_separador si es un espacio, punto, guion, etc.
function limpiarCuentaInput(valor: string): string {
  return (valor ?? '').replace(/\D/g, '');
}

// Formatea una cadena de dígitos según las longitudes de segmento,
// insertando el caracter_separador configurado entre cada segmento completo.
function aplicarMascaraCuenta(digitos: string, segmentLengths: number[], caracterSeparador: string): string {
  const partes: string[] = [];
  let cursor = 0;
  for (const len of segmentLengths) {
    if (cursor >= digitos.length) break;
    partes.push(digitos.slice(cursor, cursor + len));
    cursor += len;
  }
  return partes.join(caracterSeparador);
}

// Determina si la cantidad de dígitos capturada cae exactamente en un límite
// de segmento válido (ej. 3, 7 o 10 dígitos para la estructura "3-4-3") y, de
// ser así, regresa la cadena jerárquica ya formateada con el separador
// configurado (nivel 1, nivel 1+2, ..., nivel final). Si la cantidad de
// dígitos queda a la mitad de un segmento o excede la capacidad total,
// regresa null (cuenta inválida contra la estructura configurada).
function calcularNivelesPorDigitos(digitos: string, segmentLengths: number[], caracterSeparador: string): string[] | null {
  if (!digitos) return null;
  const niveles: string[] = [];
  let cursor = 0;
  for (const len of segmentLengths) {
    cursor += len;
    if (cursor > digitos.length) return null;
    niveles.push(aplicarMascaraCuenta(digitos.slice(0, cursor), segmentLengths, caracterSeparador));
    if (cursor === digitos.length) return niveles;
  }
  return null;
}

export async function analizarCuentaNueva(
  empresaId: number,
  cuentaCapturada: string
): Promise<{ nivel: number; niveles: NivelCuentaInfo[] }> {
  const configuracion = await obtenerOCrearConfiguracion(empresaId);
  const segmentLengths = parseEstructuraCuentas(configuracion.estructura_cuentas);
  const digitos = limpiarCuentaInput(cuentaCapturada);
  const codigosNiveles = calcularNivelesPorDigitos(digitos, segmentLengths, configuracion.caracter_separador);
  if (!codigosNiveles) {
    throw new Error(
      `VALIDATION_ERROR: La cuenta no coincide con la estructura configurada (${configuracion.estructura_cuentas})`
    );
  }

  const existentes = await listarCuentasPorCodigos(empresaId, codigosNiveles);

  const niveles: NivelCuentaInfo[] = codigosNiveles.map((codigo, index) => {
    const existente = existentes.get(codigo);
    const esFinal = index === codigosNiveles.length - 1;
    return {
      cuenta: codigo,
      nivel: index + 1,
      existe: Boolean(existente),
      id: existente?.id ?? null,
      requiere_descripcion: !existente,
      es_cuenta_final: esFinal,
    };
  });

  return { nivel: codigosNiveles.length, niveles };
}

export async function crearCuentaJerarquica(empresaId: number, input: CuentaNuevaInput): Promise<Cuenta> {
  if (!input.cuenta) {
    throw new Error('VALIDATION_ERROR: El número de cuenta es requerido');
  }
  if (!input.descripcion?.trim()) {
    throw new Error('VALIDATION_ERROR: La descripción es requerida');
  }

  const configuracion = await obtenerOCrearConfiguracion(empresaId);
  const segmentLengths = parseEstructuraCuentas(configuracion.estructura_cuentas);
  const digitos = limpiarCuentaInput(input.cuenta);
  const codigosNiveles = calcularNivelesPorDigitos(digitos, segmentLengths, configuracion.caracter_separador);
  if (!codigosNiveles) {
    throw new Error(
      `VALIDATION_ERROR: La cuenta no coincide con la estructura configurada (${configuracion.estructura_cuentas})`
    );
  }

  const existentesMap = await listarCuentasPorCodigos(empresaId, codigosNiveles);

  const cuentaFinal = codigosNiveles[codigosNiveles.length - 1];
  if (existentesMap.has(cuentaFinal)) {
    throw new Error('VALIDATION_ERROR: La cuenta contable ya existe.');
  }

  if (input.rango_cuenta_id != null) {
    const { rows } = await pool.query(
      `SELECT 1 FROM contabilidad.rangos_cuentas WHERE empresa_id = $1 AND id = $2`,
      [empresaId, input.rango_cuenta_id]
    );
    if (!rows.length) {
      throw new Error('VALIDATION_ERROR: El rango de cuenta seleccionado no existe');
    }
  }

  const descripcionesFaltantes = input.descripciones_faltantes ?? {};
  for (let i = 0; i < codigosNiveles.length - 1; i++) {
    const codigo = codigosNiveles[i];
    if (!existentesMap.has(codigo) && !descripcionesFaltantes[codigo]?.trim()) {
      throw new Error(`VALIDATION_ERROR: Falta la descripción de la cuenta ${codigo}`);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let padreId: number | null = null;
    let cuentaCreada: Cuenta | null = null;

    for (let i = 0; i < codigosNiveles.length; i++) {
      const codigo = codigosNiveles[i];
      const nivel = i + 1;
      const esFinal = i === codigosNiveles.length - 1;
      const existente = existentesMap.get(codigo);

      if (existente) {
        if (!esFinal) {
          await degradarPadreSiAfectable(client, existente.id, empresaId);
        }
        padreId = existente.id;
        continue;
      }

      const descripcion = esFinal ? input.descripcion.trim() : descripcionesFaltantes[codigo].trim();
      const afectable = esFinal ? input.afectable ?? true : false;
      const padreDeEstaFila: number | null = padreId;

      const valoresInsert: Array<string | number | boolean | null> = [
        empresaId,
        codigo,
        descripcion,
        padreDeEstaFila,
        nivel,
        afectable,
        esFinal ? input.rango_cuenta_id ?? null : null,
        esFinal ? input.subgrupo?.trim() || null : null,
        esFinal ? input.codigo_agrupador_sat?.trim() || null : null,
        esFinal ? input.rubro_presupuesto?.trim() || null : null,
        esFinal ? input.no_considerar_presupuesto ?? true : true,
        esFinal ? input.observaciones?.trim() || null : null,
        esFinal ? input.activa ?? true : true,
      ];

      const resultadoInsert: { rows: Cuenta[] } = await client.query<Cuenta>(
        `INSERT INTO contabilidad.cuentas
           (empresa_id, cuenta, descripcion, cuenta_padre_id, nivel, afectable,
            rango_cuenta_id, subgrupo, codigo_agrupador_sat, rubro_presupuesto,
            no_considerar_presupuesto, observaciones, activa)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        valoresInsert
      );

      const filaCreada: Cuenta = resultadoInsert.rows[0];

      if (padreDeEstaFila != null) {
        await degradarPadreSiAfectable(client, padreDeEstaFila, empresaId);
      }

      padreId = filaCreada.id;
      cuentaCreada = filaCreada;
    }

    await client.query('COMMIT');
    return cuentaCreada as Cuenta;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function actualizarCuenta(id: number, empresaId: number, input: CuentaEdicionInput): Promise<Cuenta | null> {
  const actual = await obtenerCuentaPorId(id, empresaId);
  if (!actual) return null;

  if (!input.descripcion?.trim()) {
    throw new Error('VALIDATION_ERROR: La descripción es requerida');
  }

  const afectable = input.afectable ?? actual.afectable;
  if (afectable && (await tieneHijos(id, empresaId))) {
    throw new Error('VALIDATION_ERROR: No se puede marcar como afectable una cuenta que tiene subcuentas');
  }

  if (input.rango_cuenta_id != null) {
    const { rows } = await pool.query(
      `SELECT 1 FROM contabilidad.rangos_cuentas WHERE empresa_id = $1 AND id = $2`,
      [empresaId, input.rango_cuenta_id]
    );
    if (!rows.length) {
      throw new Error('VALIDATION_ERROR: El rango de cuenta seleccionado no existe');
    }
  }

  const { rows } = await pool.query<Cuenta>(
    `UPDATE contabilidad.cuentas
       SET descripcion = $1, afectable = $2, rango_cuenta_id = $3, subgrupo = $4,
           codigo_agrupador_sat = $5, rubro_presupuesto = $6, no_considerar_presupuesto = $7,
           observaciones = $8, actualizado_en = now()
     WHERE id = $9 AND empresa_id = $10
     RETURNING *`,
    [
      input.descripcion.trim(),
      afectable,
      input.rango_cuenta_id ?? null,
      input.subgrupo?.trim() || null,
      input.codigo_agrupador_sat?.trim() || null,
      input.rubro_presupuesto?.trim() || null,
      input.no_considerar_presupuesto ?? actual.no_considerar_presupuesto,
      input.observaciones?.trim() || null,
      id,
      empresaId,
    ]
  );
  return rows[0];
}

export async function cambiarEstadoCuenta(id: number, empresaId: number, activa: boolean): Promise<Cuenta | null> {
  const { rows } = await pool.query<Cuenta>(
    `UPDATE contabilidad.cuentas SET activa = $1, actualizado_en = now() WHERE id = $2 AND empresa_id = $3 RETURNING *`,
    [activa, id, empresaId]
  );
  return rows[0] ?? null;
}
