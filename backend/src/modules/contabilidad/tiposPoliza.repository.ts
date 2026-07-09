import pool from '../../config/database';

export interface TipoPoliza {
  id: number;
  empresa_id: number;
  identificador: string;
  poliza_inicial: number;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export type TipoPolizaInput = {
  identificador: string;
  poliza_inicial: number;
  activo?: boolean;
};

function validarInput(input: TipoPolizaInput) {
  if (!input.identificador?.trim()) {
    throw new Error('VALIDATION_ERROR: El identificador es requerido');
  }
  if (!Number.isInteger(input.poliza_inicial) || input.poliza_inicial <= 0) {
    throw new Error('VALIDATION_ERROR: La póliza inicial debe ser un número entero mayor que cero');
  }
}

export async function listarTiposPoliza(empresaId: number, opts: { soloActivos?: boolean } = {}): Promise<TipoPoliza[]> {
  const condiciones = ['empresa_id = $1'];
  if (opts.soloActivos) condiciones.push('activo = true');
  const { rows } = await pool.query<TipoPoliza>(
    `SELECT * FROM contabilidad.tipos_poliza WHERE ${condiciones.join(' AND ')} ORDER BY identificador`,
    [empresaId]
  );
  return rows;
}

export async function obtenerTipoPolizaPorId(id: number, empresaId: number): Promise<TipoPoliza | null> {
  const { rows } = await pool.query<TipoPoliza>(
    `SELECT * FROM contabilidad.tipos_poliza WHERE empresa_id = $1 AND id = $2`,
    [empresaId, id]
  );
  return rows[0] ?? null;
}

async function obtenerTipoPolizaPorIdentificador(
  identificador: string,
  empresaId: number,
  excluirId?: number
): Promise<TipoPoliza | null> {
  const condiciones = ['empresa_id = $1', 'identificador = $2'];
  const params: Array<string | number> = [empresaId, identificador];
  if (excluirId != null) {
    params.push(excluirId);
    condiciones.push(`id <> $${params.length}`);
  }
  const { rows } = await pool.query<TipoPoliza>(
    `SELECT * FROM contabilidad.tipos_poliza WHERE ${condiciones.join(' AND ')}`,
    params
  );
  return rows[0] ?? null;
}

export async function crearTipoPoliza(empresaId: number, input: TipoPolizaInput): Promise<TipoPoliza> {
  validarInput(input);

  const existente = await obtenerTipoPolizaPorIdentificador(input.identificador.trim(), empresaId);
  if (existente) {
    throw new Error('VALIDATION_ERROR: Ya existe un tipo de póliza con ese identificador en esta empresa');
  }

  const { rows } = await pool.query<TipoPoliza>(
    `INSERT INTO contabilidad.tipos_poliza (empresa_id, identificador, poliza_inicial, activo)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [empresaId, input.identificador.trim(), input.poliza_inicial, input.activo ?? true]
  );
  return rows[0];
}

export async function actualizarTipoPoliza(
  id: number,
  empresaId: number,
  input: TipoPolizaInput
): Promise<TipoPoliza | null> {
  const actual = await obtenerTipoPolizaPorId(id, empresaId);
  if (!actual) return null;

  validarInput(input);

  const identificador = input.identificador.trim();
  if (identificador !== actual.identificador) {
    const duplicado = await obtenerTipoPolizaPorIdentificador(identificador, empresaId, id);
    if (duplicado) {
      throw new Error('VALIDATION_ERROR: Ya existe un tipo de póliza con ese identificador en esta empresa');
    }
  }

  const { rows } = await pool.query<TipoPoliza>(
    `UPDATE contabilidad.tipos_poliza
       SET identificador = $1, poliza_inicial = $2, activo = $3, actualizado_en = now()
     WHERE empresa_id = $4 AND id = $5
     RETURNING *`,
    [identificador, input.poliza_inicial, input.activo ?? actual.activo, empresaId, id]
  );
  return rows[0];
}

export async function cambiarEstadoTipoPoliza(id: number, empresaId: number, activo: boolean): Promise<TipoPoliza | null> {
  const { rows } = await pool.query<TipoPoliza>(
    `UPDATE contabilidad.tipos_poliza SET activo = $1, actualizado_en = now() WHERE id = $2 AND empresa_id = $3 RETURNING *`,
    [activo, id, empresaId]
  );
  return rows[0] ?? null;
}

// Eliminación física: solo procede si ninguna póliza usa este tipo.
export async function eliminarTipoPoliza(id: number, empresaId: number): Promise<boolean | null> {
  const actual = await obtenerTipoPolizaPorId(id, empresaId);
  if (!actual) return null;

  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM contabilidad.polizas WHERE empresa_id = $1 AND tipo_poliza_id = $2`,
    [empresaId, id]
  );
  if (Number(rows[0].count) > 0) {
    throw new Error('VALIDATION_ERROR: No se puede eliminar el tipo de póliza porque ya tiene pólizas asociadas.');
  }

  await pool.query(`DELETE FROM contabilidad.tipos_poliza WHERE empresa_id = $1 AND id = $2`, [empresaId, id]);
  return true;
}
