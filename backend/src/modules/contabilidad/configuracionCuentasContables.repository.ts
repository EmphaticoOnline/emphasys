import pool from '../../config/database';

export const USOS_CONTABLES = [
  'cliente_cxc',
  'proveedor_cxp',
  'banco_caja',
  'concepto_tesoreria',
  'venta_producto',
  'compra_producto',
  'inventario_almacen',
  'costo_ventas',
  'ajuste_inventario_positivo',
  'ajuste_inventario_negativo',
  'merma_inventario',
  'traspaso_inventario',
  'iva_trasladado',
  'iva_acreditable',
  'retencion_iva',
  'retencion_isr',
  'ieps',
  'impuesto_otro',
] as const;

export type UsoContable = (typeof USOS_CONTABLES)[number];

export type TipoEntidad =
  | 'global'
  | 'contacto'
  | 'producto'
  | 'almacen'
  | 'finanzas_cuenta'
  | 'concepto'
  | 'impuesto'
  | 'producto_familia'
  | 'producto_linea'
  | 'producto_clasificacion'
  | 'producto_tipo';

export interface ConfiguracionCuentaContable {
  id: number;
  empresa_id: number;
  cuenta_id: number;
  contacto_id: number | null;
  producto_id: number | null;
  almacen_id: number | null;
  finanzas_cuenta_id: number | null;
  concepto_id: number | null;
  impuesto_id: string | null;
  producto_familia: string | null;
  producto_linea: string | null;
  producto_clasificacion: string | null;
  producto_tipo: string | null;
  uso_contable: UsoContable;
  activa: boolean;
  notas: string | null;
  creado_en: string;
  actualizado_en: string;
  // Datos enriquecidos, agregados por join (ver mapearFilaEnriquecida).
  cuenta: string;
  descripcion_cuenta: string;
  entidad_tipo: TipoEntidad;
  entidad_nombre: string;
}

export type ConfiguracionCuentaContableInput = {
  cuenta_id: number;
  uso_contable: string;
  contacto_id?: number | null;
  producto_id?: number | null;
  almacen_id?: number | null;
  finanzas_cuenta_id?: number | null;
  concepto_id?: number | null;
  impuesto_id?: string | null;
  producto_familia?: string | null;
  producto_linea?: string | null;
  producto_clasificacion?: string | null;
  producto_tipo?: string | null;
  activa?: boolean;
  notas?: string | null;
};

export interface FiltrosListado {
  uso_contable?: string;
  contacto_id?: number;
  producto_id?: number;
  almacen_id?: number;
  finanzas_cuenta_id?: number;
  concepto_id?: number;
  impuesto_id?: string;
  activa?: boolean;
}

const CAMPOS_ENTIDAD = [
  'contacto_id',
  'producto_id',
  'almacen_id',
  'finanzas_cuenta_id',
  'concepto_id',
  'impuesto_id',
  'producto_familia',
  'producto_linea',
  'producto_clasificacion',
  'producto_tipo',
] as const;

type CampoEntidad = (typeof CAMPOS_ENTIDAD)[number];

const SELECT_ENRIQUECIDO = `
  SELECT
    ccc.*,
    c.cuenta AS cuenta,
    c.descripcion AS descripcion_cuenta,
    ct.nombre AS contacto_nombre,
    p.clave AS producto_clave,
    p.descripcion AS producto_descripcion,
    a.nombre AS almacen_nombre,
    fc.identificador AS finanzas_cuenta_identificador,
    co.nombre_concepto AS concepto_nombre,
    imp.nombre AS impuesto_nombre
  FROM contabilidad.configuracion_cuentas_contables ccc
  JOIN contabilidad.cuentas c ON c.id = ccc.cuenta_id
  LEFT JOIN public.contactos ct ON ct.id = ccc.contacto_id
  LEFT JOIN public.productos p ON p.id = ccc.producto_id
  LEFT JOIN inventario.almacenes a ON a.id = ccc.almacen_id
  LEFT JOIN public.finanzas_cuentas fc ON fc.id = ccc.finanzas_cuenta_id
  LEFT JOIN public.conceptos co ON co.id = ccc.concepto_id
  LEFT JOIN public.impuestos imp ON imp.id = ccc.impuesto_id
`;

type FilaCruda = ConfiguracionCuentaContable & {
  contacto_nombre: string | null;
  producto_clave: string | null;
  producto_descripcion: string | null;
  almacen_nombre: string | null;
  finanzas_cuenta_identificador: string | null;
  concepto_nombre: string | null;
  impuesto_nombre: string | null;
};

function determinarEntidad(fila: FilaCruda): { tipo: TipoEntidad; nombre: string } {
  if (fila.contacto_id != null) return { tipo: 'contacto', nombre: fila.contacto_nombre ?? `Contacto #${fila.contacto_id}` };
  if (fila.producto_id != null) {
    const nombre = [fila.producto_clave, fila.producto_descripcion].filter(Boolean).join(' - ');
    return { tipo: 'producto', nombre: nombre || `Producto #${fila.producto_id}` };
  }
  if (fila.almacen_id != null) return { tipo: 'almacen', nombre: fila.almacen_nombre ?? `Almacén #${fila.almacen_id}` };
  if (fila.finanzas_cuenta_id != null) {
    return { tipo: 'finanzas_cuenta', nombre: fila.finanzas_cuenta_identificador ?? `Cuenta financiera #${fila.finanzas_cuenta_id}` };
  }
  if (fila.concepto_id != null) return { tipo: 'concepto', nombre: fila.concepto_nombre ?? `Concepto #${fila.concepto_id}` };
  if (fila.impuesto_id != null) return { tipo: 'impuesto', nombre: fila.impuesto_nombre ?? fila.impuesto_id };
  if (fila.producto_familia != null) return { tipo: 'producto_familia', nombre: fila.producto_familia };
  if (fila.producto_linea != null) return { tipo: 'producto_linea', nombre: fila.producto_linea };
  if (fila.producto_clasificacion != null) return { tipo: 'producto_clasificacion', nombre: fila.producto_clasificacion };
  if (fila.producto_tipo != null) return { tipo: 'producto_tipo', nombre: fila.producto_tipo };
  return { tipo: 'global', nombre: 'Global' };
}

function mapearFilaEnriquecida(fila: FilaCruda): ConfiguracionCuentaContable {
  const { tipo, nombre } = determinarEntidad(fila);
  const {
    contacto_nombre,
    producto_clave,
    producto_descripcion,
    almacen_nombre,
    finanzas_cuenta_identificador,
    concepto_nombre,
    impuesto_nombre,
    ...resto
  } = fila;
  return {
    ...resto,
    id: Number(resto.id),
    cuenta_id: Number(resto.cuenta_id),
    empresa_id: Number(resto.empresa_id),
    entidad_tipo: tipo,
    entidad_nombre: nombre,
  };
}

export async function listarConfiguraciones(
  empresaId: number,
  filtros: FiltrosListado = {}
): Promise<ConfiguracionCuentaContable[]> {
  const condiciones = ['ccc.empresa_id = $1'];
  const params: Array<string | number | boolean> = [empresaId];

  if (filtros.uso_contable) {
    params.push(filtros.uso_contable);
    condiciones.push(`ccc.uso_contable = $${params.length}`);
  }
  if (filtros.contacto_id != null) {
    params.push(filtros.contacto_id);
    condiciones.push(`ccc.contacto_id = $${params.length}`);
  }
  if (filtros.producto_id != null) {
    params.push(filtros.producto_id);
    condiciones.push(`ccc.producto_id = $${params.length}`);
  }
  if (filtros.almacen_id != null) {
    params.push(filtros.almacen_id);
    condiciones.push(`ccc.almacen_id = $${params.length}`);
  }
  if (filtros.finanzas_cuenta_id != null) {
    params.push(filtros.finanzas_cuenta_id);
    condiciones.push(`ccc.finanzas_cuenta_id = $${params.length}`);
  }
  if (filtros.concepto_id != null) {
    params.push(filtros.concepto_id);
    condiciones.push(`ccc.concepto_id = $${params.length}`);
  }
  if (filtros.impuesto_id) {
    params.push(filtros.impuesto_id);
    condiciones.push(`ccc.impuesto_id = $${params.length}`);
  }
  if (filtros.activa != null) {
    params.push(filtros.activa);
    condiciones.push(`ccc.activa = $${params.length}`);
  }

  const { rows } = await pool.query<FilaCruda>(
    `${SELECT_ENRIQUECIDO} WHERE ${condiciones.join(' AND ')} ORDER BY ccc.uso_contable, ccc.id DESC`,
    params
  );
  return rows.map(mapearFilaEnriquecida);
}

export async function obtenerConfiguracionPorId(id: number, empresaId: number): Promise<ConfiguracionCuentaContable | null> {
  const { rows } = await pool.query<FilaCruda>(
    `${SELECT_ENRIQUECIDO} WHERE ccc.id = $1 AND ccc.empresa_id = $2`,
    [id, empresaId]
  );
  return rows[0] ? mapearFilaEnriquecida(rows[0]) : null;
}

function extraerValoresEntidad(input: ConfiguracionCuentaContableInput): Record<CampoEntidad, string | number | null> {
  return {
    contacto_id: input.contacto_id ?? null,
    producto_id: input.producto_id ?? null,
    almacen_id: input.almacen_id ?? null,
    finanzas_cuenta_id: input.finanzas_cuenta_id ?? null,
    concepto_id: input.concepto_id ?? null,
    impuesto_id: input.impuesto_id?.trim() || null,
    producto_familia: input.producto_familia?.trim() || null,
    producto_linea: input.producto_linea?.trim() || null,
    producto_clasificacion: input.producto_clasificacion?.trim() || null,
    producto_tipo: input.producto_tipo?.trim() || null,
  };
}

function validarUnaSolaEntidad(valores: Record<CampoEntidad, string | number | null>) {
  const definidos = CAMPOS_ENTIDAD.filter((campo) => valores[campo] != null);
  if (definidos.length > 1) {
    throw new Error(
      'VALIDATION_ERROR: Solo se puede asignar una entidad destino por configuración (contacto, producto, almacén, cuenta financiera, concepto, impuesto o atributo de producto).'
    );
  }
}

async function validarCuentaContable(empresaId: number, cuentaId: number): Promise<void> {
  const { rows } = await pool.query<{ activa: boolean; afectable: boolean }>(
    `SELECT activa, afectable FROM contabilidad.cuentas WHERE id = $1 AND empresa_id = $2`,
    [cuentaId, empresaId]
  );
  const cuenta = rows[0];
  if (!cuenta) {
    throw new Error('VALIDATION_ERROR: La cuenta contable no existe en esta empresa.');
  }
  if (!cuenta.activa) {
    throw new Error('VALIDATION_ERROR: La cuenta contable no está activa.');
  }
  if (!cuenta.afectable) {
    throw new Error('VALIDATION_ERROR: La cuenta contable no es afectable (tiene subcuentas).');
  }
}

async function existeEnEmpresa(tabla: string, id: number | string, empresaId: number): Promise<boolean> {
  const { rows } = await pool.query<{ existe: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM ${tabla} WHERE id = $1 AND empresa_id = $2) AS existe`,
    [id, empresaId]
  );
  return rows[0].existe;
}

async function existeGlobal(tabla: string, id: number | string): Promise<boolean> {
  const { rows } = await pool.query<{ existe: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM ${tabla} WHERE id = $1) AS existe`,
    [id]
  );
  return rows[0].existe;
}

// Para cliente_cxc/proveedor_cxp el contacto debe ser del tipo correspondiente
// (o 'Varios', que aplica a ambos contextos). Mismo criterio que
// obtenerContactos/obtenerContactosPaginados en el módulo de contactos, que ya
// agregan 'varios' automáticamente al filtrar por 'cliente' o 'proveedor'.
async function validarTipoContactoParaUso(
  empresaId: number,
  usoContable: string,
  contactoId: number | string
): Promise<void> {
  if (usoContable !== 'cliente_cxc' && usoContable !== 'proveedor_cxp') return;

  const { rows } = await pool.query<{ tipo_contacto: string }>(
    `SELECT tipo_contacto::text AS tipo_contacto FROM public.contactos WHERE id = $1 AND empresa_id = $2`,
    [contactoId, empresaId]
  );
  const tipoContacto = rows[0]?.tipo_contacto?.toLowerCase();

  if (usoContable === 'cliente_cxc' && !['cliente', 'varios'].includes(tipoContacto ?? '')) {
    throw new Error('VALIDATION_ERROR: Para el uso contable "Cliente (CxC)" el contacto debe ser de tipo Cliente o Varios.');
  }
  if (usoContable === 'proveedor_cxp' && !['proveedor', 'varios'].includes(tipoContacto ?? '')) {
    throw new Error('VALIDATION_ERROR: Para el uso contable "Proveedor (CxP)" el contacto debe ser de tipo Proveedor o Varios.');
  }
}

async function validarEntidadDestino(
  empresaId: number,
  usoContable: string,
  valores: Record<CampoEntidad, string | number | null>
): Promise<void> {
  if (valores.contacto_id != null) {
    if (!(await existeEnEmpresa('public.contactos', valores.contacto_id, empresaId))) {
      throw new Error('VALIDATION_ERROR: El contacto no existe en esta empresa.');
    }
    await validarTipoContactoParaUso(empresaId, usoContable, valores.contacto_id);
  }
  if (valores.producto_id != null && !(await existeEnEmpresa('public.productos', valores.producto_id, empresaId))) {
    throw new Error('VALIDATION_ERROR: El producto no existe en esta empresa.');
  }
  if (valores.almacen_id != null && !(await existeEnEmpresa('inventario.almacenes', valores.almacen_id, empresaId))) {
    throw new Error('VALIDATION_ERROR: El almacén no existe en esta empresa.');
  }
  if (
    valores.finanzas_cuenta_id != null &&
    !(await existeEnEmpresa('public.finanzas_cuentas', valores.finanzas_cuenta_id, empresaId))
  ) {
    throw new Error('VALIDATION_ERROR: La cuenta financiera no existe en esta empresa.');
  }
  if (valores.concepto_id != null && !(await existeEnEmpresa('public.conceptos', valores.concepto_id, empresaId))) {
    throw new Error('VALIDATION_ERROR: El concepto no existe en esta empresa.');
  }
  // public.impuestos es un catálogo global (sin empresa_id).
  if (valores.impuesto_id != null && !(await existeGlobal('public.impuestos', valores.impuesto_id))) {
    throw new Error('VALIDATION_ERROR: El impuesto no existe.');
  }
}

async function validarDuplicado(
  empresaId: number,
  usoContable: string,
  valores: Record<CampoEntidad, string | number | null>,
  excluirId?: number
): Promise<void> {
  const condiciones = ['empresa_id = $1', 'uso_contable = $2'];
  const params: Array<string | number> = [empresaId, usoContable];

  for (const campo of CAMPOS_ENTIDAD) {
    const valor = valores[campo];
    if (valor == null) {
      condiciones.push(`${campo} IS NULL`);
    } else {
      params.push(valor);
      condiciones.push(`${campo} = $${params.length}`);
    }
  }

  if (excluirId != null) {
    params.push(excluirId);
    condiciones.push(`id <> $${params.length}`);
  }

  const { rows } = await pool.query<{ existe: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM contabilidad.configuracion_cuentas_contables WHERE ${condiciones.join(' AND ')}) AS existe`,
    params
  );
  if (rows[0].existe) {
    throw new Error('VALIDATION_ERROR: Ya existe una configuración con esta empresa, uso contable y entidad destino.');
  }
}

function validarInputBase(input: ConfiguracionCuentaContableInput): void {
  if (!input.cuenta_id || !Number.isFinite(Number(input.cuenta_id))) {
    throw new Error('VALIDATION_ERROR: La cuenta contable es requerida.');
  }
  if (!input.uso_contable) {
    throw new Error('VALIDATION_ERROR: El uso contable es requerido.');
  }
  if (!USOS_CONTABLES.includes(input.uso_contable as UsoContable)) {
    throw new Error('VALIDATION_ERROR: El uso contable no es válido.');
  }
}

export async function crearConfiguracion(
  empresaId: number,
  input: ConfiguracionCuentaContableInput
): Promise<ConfiguracionCuentaContable> {
  validarInputBase(input);
  const valores = extraerValoresEntidad(input);
  validarUnaSolaEntidad(valores);

  const cuentaId = Number(input.cuenta_id);
  await validarCuentaContable(empresaId, cuentaId);
  await validarEntidadDestino(empresaId, input.uso_contable, valores);
  await validarDuplicado(empresaId, input.uso_contable, valores);

  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO contabilidad.configuracion_cuentas_contables
       (empresa_id, cuenta_id, uso_contable, contacto_id, producto_id, almacen_id,
        finanzas_cuenta_id, concepto_id, impuesto_id, producto_familia, producto_linea,
        producto_clasificacion, producto_tipo, activa, notas)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id`,
    [
      empresaId,
      cuentaId,
      input.uso_contable,
      valores.contacto_id,
      valores.producto_id,
      valores.almacen_id,
      valores.finanzas_cuenta_id,
      valores.concepto_id,
      valores.impuesto_id,
      valores.producto_familia,
      valores.producto_linea,
      valores.producto_clasificacion,
      valores.producto_tipo,
      input.activa ?? true,
      input.notas?.trim() || null,
    ]
  );

  return (await obtenerConfiguracionPorId(rows[0].id, empresaId)) as ConfiguracionCuentaContable;
}

export async function actualizarConfiguracion(
  id: number,
  empresaId: number,
  input: ConfiguracionCuentaContableInput
): Promise<ConfiguracionCuentaContable | null> {
  const actual = await obtenerConfiguracionPorId(id, empresaId);
  if (!actual) return null;

  validarInputBase(input);
  const valores = extraerValoresEntidad(input);
  validarUnaSolaEntidad(valores);

  const cuentaId = Number(input.cuenta_id);
  await validarCuentaContable(empresaId, cuentaId);
  await validarEntidadDestino(empresaId, input.uso_contable, valores);
  await validarDuplicado(empresaId, input.uso_contable, valores, id);

  await pool.query(
    `UPDATE contabilidad.configuracion_cuentas_contables
       SET cuenta_id = $1, uso_contable = $2, contacto_id = $3, producto_id = $4, almacen_id = $5,
           finanzas_cuenta_id = $6, concepto_id = $7, impuesto_id = $8, producto_familia = $9,
           producto_linea = $10, producto_clasificacion = $11, producto_tipo = $12,
           activa = $13, notas = $14, actualizado_en = now()
     WHERE id = $15 AND empresa_id = $16`,
    [
      cuentaId,
      input.uso_contable,
      valores.contacto_id,
      valores.producto_id,
      valores.almacen_id,
      valores.finanzas_cuenta_id,
      valores.concepto_id,
      valores.impuesto_id,
      valores.producto_familia,
      valores.producto_linea,
      valores.producto_clasificacion,
      valores.producto_tipo,
      input.activa ?? actual.activa,
      input.notas?.trim() || null,
      id,
      empresaId,
    ]
  );

  return obtenerConfiguracionPorId(id, empresaId);
}

export async function eliminarConfiguracion(id: number, empresaId: number): Promise<boolean | null> {
  const actual = await obtenerConfiguracionPorId(id, empresaId);
  if (!actual) return null;

  await pool.query(`DELETE FROM contabilidad.configuracion_cuentas_contables WHERE id = $1 AND empresa_id = $2`, [
    id,
    empresaId,
  ]);
  return true;
}

// ---------------------------------------------------------------------------
// Valores distintos usados por productos de la empresa, para poblar los
// selectores de familia/línea/clasificación/tipo sin permitir captura libre.
// ---------------------------------------------------------------------------

const CAMPOS_PRODUCTO_VALIDOS = ['familia', 'linea', 'clasificacion', 'tipo_producto'] as const;
export type CampoProducto = (typeof CAMPOS_PRODUCTO_VALIDOS)[number];

export async function listarValoresProducto(empresaId: number, campo: string): Promise<string[]> {
  if (!CAMPOS_PRODUCTO_VALIDOS.includes(campo as CampoProducto)) {
    throw new Error('VALIDATION_ERROR: Campo de producto no válido.');
  }
  const { rows } = await pool.query<{ valor: string }>(
    `SELECT DISTINCT ${campo} AS valor FROM public.productos
     WHERE empresa_id = $1 AND ${campo} IS NOT NULL AND ${campo} <> ''
     ORDER BY ${campo}`,
    [empresaId]
  );
  return rows.map((r) => r.valor);
}

// ---------------------------------------------------------------------------
// Función de apoyo para el futuro motor de contabilización automática. Por
// ahora no se conecta a ningún flujo de generación de pólizas: solo resuelve,
// dada una empresa/uso contable y las entidades disponibles, cuál
// configuración activa aplica, de la más específica a la más genérica.
// ---------------------------------------------------------------------------

export interface ResolverCuentaParams {
  empresaId: number;
  usoContable: string;
  contactoId?: number | null;
  productoId?: number | null;
  almacenId?: number | null;
  finanzasCuentaId?: number | null;
  conceptoId?: number | null;
  impuestoId?: string | null;
  productoFamilia?: string | null;
  productoLinea?: string | null;
  productoClasificacion?: string | null;
  productoTipo?: string | null;
}

export interface CuentaResuelta {
  cuenta_id: number;
  cuenta: string;
  descripcion: string;
  fuente: TipoEntidad;
  uso_contable: string;
}

async function buscarConfiguracionActiva(
  empresaId: number,
  usoContable: string,
  campo: CampoEntidad | null,
  valor: string | number | null
): Promise<{ cuenta_id: number; cuenta: string; descripcion: string } | null> {
  // Las columnas se califican con "ccc." porque el JOIN con contabilidad.cuentas
  // (también con empresa_id) vuelve ambiguas las condiciones sin prefijo.
  const condiciones = ['ccc.empresa_id = $1', 'ccc.uso_contable = $2', 'ccc.activa = true'];
  const params: Array<string | number> = [empresaId, usoContable];

  for (const otro of CAMPOS_ENTIDAD) {
    if (otro === campo) {
      params.push(valor as string | number);
      condiciones.push(`ccc.${otro} = $${params.length}`);
    } else {
      condiciones.push(`ccc.${otro} IS NULL`);
    }
  }

  const { rows } = await pool.query<{ cuenta_id: number; cuenta: string; descripcion: string }>(
    `SELECT ccc.cuenta_id, c.cuenta, c.descripcion
     FROM contabilidad.configuracion_cuentas_contables ccc
     JOIN contabilidad.cuentas c ON c.id = ccc.cuenta_id
     WHERE ${condiciones.join(' AND ')}
     LIMIT 1`,
    params
  );
  return rows[0] ?? null;
}

// Orden de resolución: entidad exacta primero (contacto/producto/almacén/
// cuenta financiera/concepto/impuesto, según lo que venga en params), luego
// atributos de producto de lo más específico a lo más genérico
// (familia > línea > clasificación > tipo), y por último la configuración
// global (uso_contable sin ninguna entidad asignada). El orden de los
// atributos de producto lo fija el motor de contabilización de ventas
// (primer consumidor real de esta función): familia antes que tipo.
export async function resolverCuentaContable(params: ResolverCuentaParams): Promise<CuentaResuelta | null> {
  const candidatos: Array<[CampoEntidad, string | number | null | undefined]> = [
    ['contacto_id', params.contactoId],
    ['producto_id', params.productoId],
    ['almacen_id', params.almacenId],
    ['finanzas_cuenta_id', params.finanzasCuentaId],
    ['concepto_id', params.conceptoId],
    ['impuesto_id', params.impuestoId],
    ['producto_familia', params.productoFamilia],
    ['producto_linea', params.productoLinea],
    ['producto_clasificacion', params.productoClasificacion],
    ['producto_tipo', params.productoTipo],
  ];

  for (const [campo, valor] of candidatos) {
    if (valor == null) continue;
    const encontrada = await buscarConfiguracionActiva(params.empresaId, params.usoContable, campo, valor);
    if (encontrada) {
      const fuente = determinarEntidad({ [campo]: valor } as unknown as FilaCruda).tipo;
      return { ...encontrada, cuenta_id: Number(encontrada.cuenta_id), fuente, uso_contable: params.usoContable };
    }
  }

  const global = await buscarConfiguracionActiva(params.empresaId, params.usoContable, null, null);
  if (global) {
    return { ...global, cuenta_id: Number(global.cuenta_id), fuente: 'global', uso_contable: params.usoContable };
  }

  return null;
}
