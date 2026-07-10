import pool from '../../config/database';

export const TIPOS_MOVIMIENTO = ['venta', 'compra', 'inventario', 'tesoreria', 'cobranza', 'pago', 'ajuste'] as const;

export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export const EVENTOS_CONTABLES = [
  'emision',
  'recepcion',
  'cobro',
  'pago',
  'entrada_inventario',
  'salida_inventario',
  'cancelacion',
  'devolucion',
  'ajuste',
  'traspaso',
] as const;

export type EventoContable = (typeof EVENTOS_CONTABLES)[number];

export const MODOS_CONTABILIZACION = ['individual', 'lote_individual', 'lote_concentrado', 'automatico'] as const;

export type ModoContabilizacion = (typeof MODOS_CONTABILIZACION)[number];

// Referencia operativa: exactamente una de las tres debe estar presente.
// documento_id cubre facturas, notas de crédito, cobros, pagos, anticipos
// y ajustes documentales (todo lo que vive en public.documentos).
export type ReferenciaOperativa = {
  documento_id?: number | null;
  operacion_dinero_id?: number | null;
  movimiento_inventario_id?: number | null;
};

const CAMPOS_REFERENCIA = ['documento_id', 'operacion_dinero_id', 'movimiento_inventario_id'] as const;
type CampoReferencia = (typeof CAMPOS_REFERENCIA)[number];

export interface Contabilizacion {
  id: number;
  empresa_id: number;
  poliza_id: number;
  tipo_movimiento: TipoMovimiento;
  tipo_documento: string;
  documento_id: number | null;
  operacion_dinero_id: number | null;
  movimiento_inventario_id: number | null;
  evento_contable: EventoContable;
  modo_contabilizacion: ModoContabilizacion;
  fecha_documento: string;
  fecha_contabilizacion: string;
  usuario_id: number | null;
  es_reversa: boolean;
  contabilizacion_origen_id: number | null;
  comentario: string | null;
  creado_en: string;
  actualizado_en: string;
}

export type ContabilizacionInput = ReferenciaOperativa & {
  poliza_id: number;
  tipo_movimiento: string;
  tipo_documento: string;
  evento_contable: string;
  modo_contabilizacion: string;
  fecha_documento: string;
  usuario_id?: number | null;
  comentario?: string | null;
};

export type ReversaInput = {
  poliza_id: number;
  // Por defecto la reversa hereda evento_contable del origen; algunos flujos
  // (ej. cancelación de factura de venta) necesitan un evento propio como
  // 'cancelacion' en vez de repetir el evento que están revirtiendo.
  evento_contable?: string;
  fecha_documento?: string;
  usuario_id?: number | null;
  comentario?: string | null;
};

export interface EstadoContableReferencia {
  contabilizado: boolean;
  editable: boolean;
  motivo: string | null;
}

function mapearFila(fila: Record<string, unknown>): Contabilizacion {
  return {
    id: Number(fila.id),
    empresa_id: Number(fila.empresa_id),
    poliza_id: Number(fila.poliza_id),
    tipo_movimiento: fila.tipo_movimiento as TipoMovimiento,
    tipo_documento: fila.tipo_documento as string,
    documento_id: fila.documento_id != null ? Number(fila.documento_id) : null,
    operacion_dinero_id: fila.operacion_dinero_id != null ? Number(fila.operacion_dinero_id) : null,
    movimiento_inventario_id: fila.movimiento_inventario_id != null ? Number(fila.movimiento_inventario_id) : null,
    evento_contable: fila.evento_contable as EventoContable,
    modo_contabilizacion: fila.modo_contabilizacion as ModoContabilizacion,
    fecha_documento: fila.fecha_documento as string,
    fecha_contabilizacion: fila.fecha_contabilizacion as string,
    usuario_id: fila.usuario_id != null ? Number(fila.usuario_id) : null,
    es_reversa: Boolean(fila.es_reversa),
    contabilizacion_origen_id: fila.contabilizacion_origen_id != null ? Number(fila.contabilizacion_origen_id) : null,
    comentario: (fila.comentario as string | null) ?? null,
    creado_en: fila.creado_en as string,
    actualizado_en: fila.actualizado_en as string,
  };
}

function extraerReferencia(input: ReferenciaOperativa): Record<CampoReferencia, number | null> {
  return {
    documento_id: input.documento_id ?? null,
    operacion_dinero_id: input.operacion_dinero_id ?? null,
    movimiento_inventario_id: input.movimiento_inventario_id ?? null,
  };
}

function validarUnaReferencia(referencia: Record<CampoReferencia, number | null>): void {
  const definidos = CAMPOS_REFERENCIA.filter((campo) => referencia[campo] != null);
  if (definidos.length !== 1) {
    throw new Error(
      'VALIDATION_ERROR: Debe indicarse exactamente una referencia operativa: documento_id, operacion_dinero_id o movimiento_inventario_id.'
    );
  }
}

function condicionReferencia(
  referencia: Record<CampoReferencia, number | null>,
  params: Array<string | number>
): string {
  const campo = CAMPOS_REFERENCIA.find((c) => referencia[c] != null) as CampoReferencia;
  params.push(referencia[campo] as number);
  return `${campo} = $${params.length}`;
}

function validarEnums(input: Pick<ContabilizacionInput, 'tipo_movimiento' | 'evento_contable' | 'modo_contabilizacion'>): void {
  if (!TIPOS_MOVIMIENTO.includes(input.tipo_movimiento as TipoMovimiento)) {
    throw new Error('VALIDATION_ERROR: tipo_movimiento no es válido.');
  }
  if (!EVENTOS_CONTABLES.includes(input.evento_contable as EventoContable)) {
    throw new Error('VALIDATION_ERROR: evento_contable no es válido.');
  }
  if (!MODOS_CONTABILIZACION.includes(input.modo_contabilizacion as ModoContabilizacion)) {
    throw new Error('VALIDATION_ERROR: modo_contabilizacion no es válido.');
  }
}

async function validarPolizaEnEmpresa(empresaId: number, polizaId: number): Promise<void> {
  const { rows } = await pool.query<{ existe: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM contabilidad.polizas WHERE id = $1 AND empresa_id = $2) AS existe`,
    [polizaId, empresaId]
  );
  if (!rows[0].existe) {
    throw new Error('VALIDATION_ERROR: La póliza no existe en esta empresa.');
  }
}

async function validarReferenciaEnEmpresa(empresaId: number, referencia: Record<CampoReferencia, number | null>): Promise<void> {
  if (referencia.documento_id != null) {
    const { rows } = await pool.query<{ existe: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM public.documentos WHERE id = $1 AND empresa_id = $2) AS existe`,
      [referencia.documento_id, empresaId]
    );
    if (!rows[0].existe) throw new Error('VALIDATION_ERROR: El documento no existe en esta empresa.');
    return;
  }
  if (referencia.operacion_dinero_id != null) {
    const { rows } = await pool.query<{ existe: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM public.finanzas_operaciones WHERE id = $1 AND empresa_id = $2) AS existe`,
      [referencia.operacion_dinero_id, empresaId]
    );
    if (!rows[0].existe) throw new Error('VALIDATION_ERROR: La operación de dinero no existe en esta empresa.');
    return;
  }
  if (referencia.movimiento_inventario_id != null) {
    const { rows } = await pool.query<{ existe: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM inventario.movimientos WHERE id = $1 AND empresa_id = $2) AS existe`,
      [referencia.movimiento_inventario_id, empresaId]
    );
    if (!rows[0].existe) throw new Error('VALIDATION_ERROR: El movimiento de inventario no existe en esta empresa.');
  }
}

export async function obtenerContabilizacionPorId(id: number, empresaId: number): Promise<Contabilizacion | null> {
  const { rows } = await pool.query(
    `SELECT * FROM contabilidad.contabilizaciones WHERE id = $1 AND empresa_id = $2`,
    [id, empresaId]
  );
  return rows[0] ? mapearFila(rows[0]) : null;
}

export async function listarContabilizacionesPorReferencia(
  empresaId: number,
  referenciaInput: ReferenciaOperativa
): Promise<Contabilizacion[]> {
  const referencia = extraerReferencia(referenciaInput);
  validarUnaReferencia(referencia);

  const params: Array<string | number> = [empresaId];
  const condicionRef = condicionReferencia(referencia, params);

  const { rows } = await pool.query(
    `SELECT * FROM contabilidad.contabilizaciones
     WHERE empresa_id = $1 AND ${condicionRef}
     ORDER BY creado_en DESC`,
    params
  );
  return rows.map(mapearFila);
}

export async function listarContabilizacionesPoliza(empresaId: number, polizaId: number): Promise<Contabilizacion[]> {
  const { rows } = await pool.query(
    `SELECT * FROM contabilidad.contabilizaciones
     WHERE empresa_id = $1 AND poliza_id = $2
     ORDER BY creado_en DESC`,
    [empresaId, polizaId]
  );
  return rows.map(mapearFila);
}

// Una referencia operativa se considera contabilizada si tiene al menos una
// fila activa (no reversa). La reversa no "desmarca" la referencia: solo
// documenta que la póliza original fue revertida, la contabilización
// original permanece.
export async function estaContabilizado(
  empresaId: number,
  referenciaInput: ReferenciaOperativa,
  eventoContable?: string
): Promise<boolean> {
  const referencia = extraerReferencia(referenciaInput);
  validarUnaReferencia(referencia);

  const params: Array<string | number> = [empresaId];
  const condicionRef = condicionReferencia(referencia, params);
  const condiciones = ['empresa_id = $1', condicionRef, 'es_reversa = false'];

  if (eventoContable) {
    params.push(eventoContable);
    condiciones.push(`evento_contable = $${params.length}`);
  }

  const { rows } = await pool.query<{ existe: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM contabilidad.contabilizaciones WHERE ${condiciones.join(' AND ')}) AS existe`,
    params
  );
  return rows[0].existe;
}

// Punto de apoyo para bloquear documentos/operaciones/movimientos en fases
// posteriores: por ahora nadie llama a esta función desde ventas, compras,
// tesorería ni inventario.
export async function puedeEditarseReferencia(
  empresaId: number,
  referenciaInput: ReferenciaOperativa
): Promise<EstadoContableReferencia> {
  const contabilizado = await estaContabilizado(empresaId, referenciaInput);
  if (contabilizado) {
    return {
      contabilizado: true,
      editable: false,
      motivo: 'Ya existe una contabilización registrada y no puede modificarse en campos contables relevantes.',
    };
  }
  return { contabilizado: false, editable: true, motivo: null };
}

export async function registrarContabilizacion(
  empresaId: number,
  input: ContabilizacionInput
): Promise<Contabilizacion> {
  validarEnums(input);

  if (!input.tipo_documento?.trim()) {
    throw new Error('VALIDATION_ERROR: tipo_documento es requerido.');
  }
  if (!input.fecha_documento) {
    throw new Error('VALIDATION_ERROR: fecha_documento es requerida.');
  }

  const referencia = extraerReferencia(input);
  validarUnaReferencia(referencia);

  const polizaId = Number(input.poliza_id);
  await validarPolizaEnEmpresa(empresaId, polizaId);
  await validarReferenciaEnEmpresa(empresaId, referencia);

  const yaContabilizado = await estaContabilizado(empresaId, referencia, input.evento_contable);
  if (yaContabilizado) {
    throw new Error(
      'VALIDATION_ERROR: Ya existe una contabilización activa para esta referencia y evento contable.'
    );
  }

  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO contabilidad.contabilizaciones
       (empresa_id, poliza_id, tipo_movimiento, tipo_documento, documento_id, operacion_dinero_id,
        movimiento_inventario_id, evento_contable, modo_contabilizacion, fecha_documento, usuario_id, comentario)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id`,
    [
      empresaId,
      polizaId,
      input.tipo_movimiento,
      input.tipo_documento.trim(),
      referencia.documento_id,
      referencia.operacion_dinero_id,
      referencia.movimiento_inventario_id,
      input.evento_contable,
      input.modo_contabilizacion,
      input.fecha_documento,
      input.usuario_id ?? null,
      input.comentario?.trim() || null,
    ]
  );

  return (await obtenerContabilizacionPorId(rows[0].id, empresaId)) as Contabilizacion;
}

export async function registrarReversa(
  empresaId: number,
  contabilizacionOrigenId: number,
  input: ReversaInput
): Promise<Contabilizacion | null> {
  const origen = await obtenerContabilizacionPorId(contabilizacionOrigenId, empresaId);
  if (!origen) return null;

  if (origen.es_reversa) {
    throw new Error('VALIDATION_ERROR: No se puede reversar una contabilización que ya es una reversa.');
  }

  const { rows: yaReversada } = await pool.query<{ existe: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM contabilidad.contabilizaciones
       WHERE contabilizacion_origen_id = $1 AND es_reversa = true
     ) AS existe`,
    [contabilizacionOrigenId]
  );
  if (yaReversada[0].existe) {
    throw new Error('VALIDATION_ERROR: Esta contabilización ya tiene una reversa registrada.');
  }

  const eventoContable = input.evento_contable ?? origen.evento_contable;
  if (!EVENTOS_CONTABLES.includes(eventoContable as EventoContable)) {
    throw new Error('VALIDATION_ERROR: evento_contable no es válido.');
  }

  const polizaId = Number(input.poliza_id);
  await validarPolizaEnEmpresa(empresaId, polizaId);

  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO contabilidad.contabilizaciones
       (empresa_id, poliza_id, tipo_movimiento, tipo_documento, documento_id, operacion_dinero_id,
        movimiento_inventario_id, evento_contable, modo_contabilizacion, fecha_documento, usuario_id,
        es_reversa, contabilizacion_origen_id, comentario)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13)
     RETURNING id`,
    [
      empresaId,
      polizaId,
      origen.tipo_movimiento,
      origen.tipo_documento,
      origen.documento_id,
      origen.operacion_dinero_id,
      origen.movimiento_inventario_id,
      eventoContable,
      origen.modo_contabilizacion,
      input.fecha_documento ?? origen.fecha_documento,
      input.usuario_id ?? null,
      contabilizacionOrigenId,
      input.comentario?.trim() || null,
    ]
  );

  return (await obtenerContabilizacionPorId(rows[0].id, empresaId)) as Contabilizacion;
}
