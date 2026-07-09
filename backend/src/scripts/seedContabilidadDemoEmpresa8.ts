#!/usr/bin/env ts-node
/**
 * Seed demo de Contabilidad — EXCLUSIVO empresa_id = 8.
 *
 * Genera pólizas contables realistas y cuadradas para un ejercicio, usando
 * la lógica real del backend (crearCuentaJerarquica / crearPolizaConMovimientos /
 * cambiarEstatusPoliza), para que la afectación de saldos mensuales ocurra
 * exactamente como si se hubiera capturado desde la UI.
 *
 * NO crea/modifica: contabilidad.tipos_poliza, contabilidad.rangos_cuentas,
 * contabilidad.configuracion, empresas, usuarios ni permisos.
 *
 * Uso:
 *   cd backend
 *   npm run seed:contabilidad -- --empresa=8 --ejercicio=2026 --confirm
 *
 * Opciones:
 *   --empresa=8        (obligatorio, debe ser 8; el seed se niega a correr con otro valor)
 *   --ejercicio=2026   (obligatorio)
 *   --confirm          (obligatorio; sin esta bandera el script aborta sin tocar la BD)
 *   --limpiar=true|false (default: true — borra solo pólizas demo del mismo ejercicio antes de recrear)
 *   --seed=STRING      (default: contabilidad-demo-empresa8-<ejercicio>)
 */

import dotenv from 'dotenv';
import path from 'path';

const projectRoot = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({ path: path.join(projectRoot, '..', '.env') });

import pool from '../config/database';
import { crearCuentaJerarquica } from '../modules/contabilidad/cuentas.repository';
import { listarTiposPoliza } from '../modules/contabilidad/tiposPoliza.repository';
import {
  crearPolizaConMovimientos,
  cambiarEstatusPoliza,
  type PolizaMovimientoInput,
} from '../modules/contabilidad/polizas.repository';

const EMPRESA_ID = 8;
const REF_PREFIX = 'DEMO-CONTABILIDAD-';
const ESTRUCTURA_ESPERADA = '3-4-3';
const SEPARADOR_ESPERADO = ' ';

// ─── CLI ─────────────────────────────────────────────────────

interface Config {
  empresa: number;
  ejercicio: number;
  confirm: boolean;
  limpiar: boolean;
  seed: string;
}

function parseCLI(): Config {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const eq = `--${flag}=`;
    const found = argv.find((a) => a.startsWith(eq));
    return found ? found.slice(eq.length) : undefined;
  };

  const empresaRaw = get('empresa') ?? '8';
  const ejercicioRaw = get('ejercicio');
  if (!ejercicioRaw || !/^\d{4}$/.test(ejercicioRaw)) {
    throw new Error('Debes indicar --ejercicio=AAAA (obligatorio, 4 dígitos)');
  }
  const empresa = Number(empresaRaw);
  const ejercicio = Number(ejercicioRaw);

  return {
    empresa,
    ejercicio,
    confirm: argv.includes('--confirm'),
    limpiar: get('limpiar') !== 'false',
    seed: get('seed') ?? `contabilidad-demo-empresa8-${ejercicio}`,
  };
}

// ─── Seguridad ───────────────────────────────────────────────

function validarSeguridad(cfg: Config): void {
  if (cfg.empresa !== EMPRESA_ID) {
    throw new Error(
      `Este seed está bloqueado a empresa_id=${EMPRESA_ID} por diseño de seguridad. Recibido --empresa=${cfg.empresa}.`
    );
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Este seed no puede ejecutarse con NODE_ENV=production.');
  }
  if (!cfg.confirm) {
    throw new Error(
      'Falta la bandera --confirm. Vuelve a ejecutar agregando --confirm para reconocer que este seed insertará ' +
        'pólizas y cuentas demo en la base de datos configurada en tu .env.'
    );
  }
}

// ─── RNG con semilla (mismo patrón que scripts/seed-demo-empresa-8.ts) ──

class SeededRng {
  private s: number;
  constructor(seed: string) {
    let h = 0x811c9dc5 >>> 0;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    this.s = h || 1;
  }
  next(): number {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 0x100000000;
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  monto(min: number, max: number): number {
    const base = this.int(min, max);
    const centavos = this.int(0, 99);
    return Math.round((base + centavos / 100) * 100) / 100;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)] as T;
  }
  bool(probabilidadTrue: number): boolean {
    return this.next() < probabilidadTrue;
  }
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

// ─── Catálogo de cuentas demo (estructura 3-4-3, separador espacio) ───
// Cada entrada crea, si hace falta, la cadena completa padre→hijo hasta la
// cuenta afectable (hoja); crearCuentaJerarquica reutiliza cualquier nivel
// que ya exista y jamás sobreescribe su descripción.

interface CuentaDemoDef {
  leaf: string;
  descripcion: string;
  ancestros: Record<string, string>;
}

const CATALOGO_CUENTAS: CuentaDemoDef[] = [
  {
    leaf: '101 0001 001',
    descripcion: 'Caja chica oficina',
    ancestros: { '101': 'Caja', '101 0001': 'Caja general' },
  },
  {
    leaf: '102 0001 001',
    descripcion: 'BBVA cuenta principal MXN',
    ancestros: { '102': 'Bancos', '102 0001': 'BBVA' },
  },
  {
    leaf: '102 0002 001',
    descripcion: 'Banorte pagos MXN',
    ancestros: { '102': 'Bancos', '102 0002': 'Banorte' },
  },
  {
    leaf: '105 0001 001',
    descripcion: 'Cliente demo general',
    ancestros: { '105': 'Clientes', '105 0001': 'Clientes nacionales' },
  },
  {
    leaf: '201 0001 001',
    descripcion: 'Proveedor demo general',
    ancestros: { '201': 'Proveedores', '201 0001': 'Proveedores nacionales' },
  },
  {
    leaf: '202 0001 001',
    descripcion: 'Acreedor servicios demo',
    ancestros: { '202': 'Acreedores', '202 0001': 'Acreedores diversos' },
  },
  {
    leaf: '301 0001 001',
    descripcion: 'Capital social demo',
    ancestros: { '301': 'Capital', '301 0001': 'Capital social' },
  },
  {
    leaf: '401 0001 001',
    descripcion: 'Ventas productos demo',
    ancestros: { '401': 'Ingresos', '401 0001': 'Ventas nacionales' },
  },
  {
    leaf: '401 0002 001',
    descripcion: 'Servicios demo',
    ancestros: { '401': 'Ingresos', '401 0002': 'Servicios' },
  },
  {
    leaf: '501 0001 001',
    descripcion: 'Renta oficina demo',
    ancestros: { '501': 'Gastos de administración', '501 0001': 'Renta' },
  },
  {
    leaf: '501 0002 001',
    descripcion: 'Internet oficina demo',
    ancestros: { '501': 'Gastos de administración', '501 0002': 'Internet y telefonía' },
  },
  {
    leaf: '501 0003 001',
    descripcion: 'Gasolina demo',
    ancestros: { '501': 'Gastos de administración', '501 0003': 'Gasolina' },
  },
  {
    leaf: '501 0004 001',
    descripcion: 'Comisiones bancarias demo',
    ancestros: { '501': 'Gastos de administración', '501 0004': 'Comisiones bancarias' },
  },
  {
    leaf: '501 0005 001',
    descripcion: 'Papelería demo',
    ancestros: { '501': 'Gastos de administración', '501 0005': 'Papelería' },
  },
];

const CAJA = '101 0001 001';
const BBVA = '102 0001 001';
const BANORTE = '102 0002 001';
const CLIENTES = '105 0001 001';
const PROVEEDORES = '201 0001 001';
const ACREEDORES = '202 0001 001';
const VENTAS = '401 0001 001';
const RENTA = '501 0001 001';
const INTERNET = '501 0002 001';
const GASOLINA = '501 0003 001';
const COMISIONES = '501 0004 001';
const PAPELERIA = '501 0005 001';

async function obtenerOCrearCuentasDemo(): Promise<Map<string, number>> {
  const idPorCodigo = new Map<string, number>();
  for (const def of CATALOGO_CUENTAS) {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM contabilidad.cuentas WHERE empresa_id = $1 AND cuenta = $2`,
      [EMPRESA_ID, def.leaf]
    );
    if (rows[0]) {
      idPorCodigo.set(def.leaf, Number(rows[0].id));
      continue;
    }
    const creada = await crearCuentaJerarquica(EMPRESA_ID, {
      cuenta: def.leaf,
      descripcion: def.descripcion,
      descripciones_faltantes: def.ancestros,
    });
    idPorCodigo.set(def.leaf, creada.id);
    console.log(`  + Cuenta creada: ${def.leaf} — ${def.descripcion}`);
  }
  return idPorCodigo;
}

// ─── Conceptos (public.conceptos, solo lectura) ─────────────

async function obtenerConceptos(): Promise<Map<string, number>> {
  const { rows } = await pool.query<{ id: number; nombre_concepto: string }>(
    `SELECT id, nombre_concepto FROM public.conceptos WHERE empresa_id = $1`,
    [EMPRESA_ID]
  );
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.nombre_concepto.trim().toLowerCase(), Number(row.id));
  }
  return map;
}

// ─── Tipos de póliza (solo lectura — jamás se crean aquí) ───

const IDENTIFICADORES_REQUERIDOS = ['Diario', 'Ingresos', 'Egresos', 'Ajuste'] as const;
type TipoPolizaIdentificador = (typeof IDENTIFICADORES_REQUERIDOS)[number];

async function obtenerTiposPolizaOFallar(): Promise<Record<TipoPolizaIdentificador, number>> {
  const tipos = await listarTiposPoliza(EMPRESA_ID);
  const resultado = {} as Record<TipoPolizaIdentificador, number>;
  for (const requerido of IDENTIFICADORES_REQUERIDOS) {
    const encontrado = tipos.find((t) => t.identificador.trim().toLowerCase() === requerido.toLowerCase());
    if (!encontrado) {
      throw new Error(`Falta el tipo de póliza '${requerido}' para empresa ${EMPRESA_ID}. Captúralo antes de ejecutar el seed.`);
    }
    resultado[requerido] = encontrado.id;
  }
  return resultado;
}

// ─── Configuración contable (solo lectura — jamás se modifica) ──

async function validarConfiguracionOFallar(): Promise<void> {
  const { rows } = await pool.query<{ estructura_cuentas: string; caracter_separador: string }>(
    `SELECT estructura_cuentas, caracter_separador FROM contabilidad.configuracion WHERE empresa_id = $1`,
    [EMPRESA_ID]
  );
  const config = rows[0];
  if (!config) {
    throw new Error(
      `La empresa ${EMPRESA_ID} no tiene contabilidad.configuracion capturada. Este seed no la crea: ` +
        `configúrala manualmente con estructura "${ESTRUCTURA_ESPERADA}" y separador espacio antes de reintentar.`
    );
  }
  if (config.estructura_cuentas !== ESTRUCTURA_ESPERADA || config.caracter_separador !== SEPARADOR_ESPERADO) {
    throw new Error(
      `La configuración contable de empresa ${EMPRESA_ID} es "${config.estructura_cuentas}" con separador ` +
        `"${config.caracter_separador}", pero este seed requiere estructura "${ESTRUCTURA_ESPERADA}" con separador espacio.`
    );
  }
}

async function obtenerEmpresaOFallar(): Promise<void> {
  const { rows } = await pool.query(`SELECT id FROM core.empresas WHERE id = $1`, [EMPRESA_ID]);
  if (!rows[0]) {
    throw new Error(`No existe ninguna empresa con id=${EMPRESA_ID}. Este seed no crea empresas.`);
  }
}

async function obtenerUsuarioDemo(): Promise<number | null> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT u.id FROM core.usuarios u
       JOIN core.usuarios_empresas ue ON ue.usuario_id = u.id
     WHERE ue.empresa_id = $1 AND ue.activo = true
     ORDER BY u.id LIMIT 1`,
    [EMPRESA_ID]
  );
  return rows[0] ? Number(rows[0].id) : null;
}

// ─── Limpieza idempotente (solo datos DEMO- del mismo ejercicio) ────
// Antes de borrar, desaplica cada póliza aplicada usando la misma lógica
// real (cambiarEstatusPoliza) para revertir sus saldos correctamente;
// nunca se toca contabilidad.cuentas_saldos_mensuales directamente.

async function limpiarDemoPrevio(ejercicio: number): Promise<void> {
  const { rows } = await pool.query<{ id: string; estatus: string }>(
    `SELECT id, estatus FROM contabilidad.polizas
      WHERE empresa_id = $1 AND ejercicio = $2 AND referencia LIKE $3`,
    [EMPRESA_ID, ejercicio, `${REF_PREFIX}%`]
  );
  if (rows.length === 0) {
    console.log('  No hay datos demo previos de este ejercicio que limpiar.');
    return;
  }
  console.log(`  Limpiando ${rows.length} pólizas demo previas del ejercicio ${ejercicio}...`);
  for (const row of rows) {
    if (row.estatus === 'aplicada') {
      await cambiarEstatusPoliza(Number(row.id), EMPRESA_ID, 'borrador');
    }
  }
  await pool.query(
    `DELETE FROM contabilidad.polizas WHERE empresa_id = $1 AND ejercicio = $2 AND referencia LIKE $3`,
    [EMPRESA_ID, ejercicio, `${REF_PREFIX}%`]
  );
  console.log('  Limpieza completada.');
}

async function abortarSiHayDemoPrevio(ejercicio: number): Promise<void> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM contabilidad.polizas
      WHERE empresa_id = $1 AND ejercicio = $2 AND referencia LIKE $3`,
    [EMPRESA_ID, ejercicio, `${REF_PREFIX}%`]
  );
  if (Number(rows[0].count) > 0) {
    throw new Error(
      `Ya existen ${rows[0].count} pólizas demo del ejercicio ${ejercicio}. Ejecuta con --limpiar=true (default) ` +
        `para regenerarlas, o elige otro --ejercicio.`
    );
  }
}

// ─── Plantillas de pólizas (siempre 2 renglones, cargo === abono) ───

type Concepto = 'Venta' | 'Compra' | 'Gasto' | 'Ajuste' | null;

interface MovPlan {
  cuenta: string;
  cargo: number;
  abono: number;
  concepto: Concepto;
}

interface PolizaSpec {
  tipo: TipoPolizaIdentificador;
  refTag: string;
  obsTexto: string;
  movimientos: MovPlan[];
}

function parPartida(cuentaCargo: string, cuentaAbono: string, monto: number, conceptoCargo: Concepto, conceptoAbono: Concepto): MovPlan[] {
  return [
    { cuenta: cuentaCargo, cargo: monto, abono: 0, concepto: conceptoCargo },
    { cuenta: cuentaAbono, cargo: 0, abono: monto, concepto: conceptoAbono },
  ];
}

function bancoAleatorio(rng: SeededRng): string {
  return rng.bool(0.5) ? BBVA : BANORTE;
}
function cajaOBanco(rng: SeededRng): string {
  return rng.bool(0.2) ? CAJA : bancoAleatorio(rng);
}

const PLANTILLAS: Record<string, (rng: SeededRng) => PolizaSpec> = {
  ventaContado: (rng) => ({
    tipo: 'Ingresos',
    refTag: 'VENTA-CONTADO',
    obsTexto: 'Venta contado cliente demo',
    movimientos: parPartida(cajaOBanco(rng), VENTAS, rng.monto(3500, 85000), null, 'Venta'),
  }),
  ventaCredito: (rng) => ({
    tipo: 'Ingresos',
    refTag: 'VENTA-CREDITO',
    obsTexto: 'Venta crédito cliente demo',
    movimientos: parPartida(CLIENTES, VENTAS, rng.monto(3500, 85000), null, 'Venta'),
  }),
  cobranza: (rng) => ({
    tipo: 'Ingresos',
    refTag: 'COBRANZA',
    obsTexto: 'Cobranza factura demo',
    movimientos: parPartida(bancoAleatorio(rng), CLIENTES, rng.monto(3500, 85000), null, null),
  }),
  pagoRenta: (rng) => ({
    tipo: 'Egresos',
    refTag: 'PAGO-RENTA',
    obsTexto: 'Pago renta oficina',
    movimientos: parPartida(RENTA, bancoAleatorio(rng), rng.monto(12000, 25000), 'Gasto', null),
  }),
  pagoInternet: (rng) => ({
    tipo: 'Egresos',
    refTag: 'PAGO-INTERNET',
    obsTexto: 'Pago internet oficina',
    movimientos: parPartida(INTERNET, bancoAleatorio(rng), rng.monto(150, 3500), 'Gasto', null),
  }),
  pagoGasolina: (rng) => ({
    tipo: 'Egresos',
    refTag: 'PAGO-GASOLINA',
    obsTexto: 'Pago gasolina operación',
    movimientos: parPartida(GASOLINA, cajaOBanco(rng), rng.monto(150, 3500), 'Gasto', null),
  }),
  comisionBancaria: (rng) => ({
    tipo: 'Egresos',
    refTag: 'COMISION-BANCARIA',
    obsTexto: 'Comisión bancaria mensual',
    movimientos: parPartida(COMISIONES, bancoAleatorio(rng), rng.monto(50, 900), 'Gasto', null),
  }),
  compraCredito: (rng) => ({
    tipo: 'Egresos',
    refTag: 'COMPRA-PROVEEDOR',
    obsTexto: 'Compra proveedor demo',
    movimientos: parPartida(PAPELERIA, PROVEEDORES, rng.monto(150, 3500), 'Compra', null),
  }),
  pagoProveedor: (rng) => ({
    tipo: 'Egresos',
    refTag: 'PAGO-PROVEEDOR',
    obsTexto: 'Pago proveedor demo',
    movimientos: parPartida(PROVEEDORES, bancoAleatorio(rng), rng.monto(5000, 60000), null, null),
  }),
  traspasoBancos: (rng) => {
    const [origen, destino] = rng.bool(0.5) ? [BBVA, BANORTE] : [BANORTE, BBVA];
    return {
      tipo: 'Diario',
      refTag: 'TRASPASO-BANCOS',
      obsTexto: 'Traspaso entre cuentas bancarias',
      movimientos: parPartida(destino, origen, rng.monto(5000, 40000), null, null),
    };
  },
  acumulacionGasto: (rng) => ({
    tipo: 'Diario',
    refTag: 'ACUMULACION-GASTO',
    obsTexto: 'Ajuste contable demo - acumulación de gasto por pagar',
    movimientos: parPartida(rng.pick([INTERNET, GASOLINA, PAPELERIA]), ACREEDORES, rng.monto(500, 5000), 'Gasto', null),
  }),
  pagoAcreedor: (rng) => ({
    tipo: 'Diario',
    refTag: 'PAGO-ACREEDOR',
    obsTexto: 'Pago acreedor diverso demo',
    movimientos: parPartida(ACREEDORES, bancoAleatorio(rng), rng.monto(500, 5000), null, null),
  }),
  ajusteComision: (rng) => ({
    tipo: 'Ajuste',
    refTag: 'AJUSTE-COMISION',
    obsTexto: 'Ajuste contable demo - comisión bancaria',
    movimientos: parPartida(COMISIONES, bancoAleatorio(rng), rng.monto(50, 900), 'Ajuste', null),
  }),
  ajusteCaja: (rng) => ({
    tipo: 'Ajuste',
    refTag: 'AJUSTE-CAJA',
    obsTexto: 'Ajuste contable demo - reclasificación de caja',
    movimientos: parPartida(CAJA, bancoAleatorio(rng), rng.monto(100, 3000), 'Ajuste', null),
  }),
};

// Distribución exacta: 10 ingresos + 10 egresos + 8 diario + 2 ajuste = 30/mes
const PLAN_MENSUAL: string[] = [
  ...Array(4).fill('ventaContado'),
  ...Array(3).fill('ventaCredito'),
  ...Array(3).fill('cobranza'),
  ...Array(1).fill('pagoRenta'),
  ...Array(1).fill('pagoInternet'),
  ...Array(2).fill('pagoGasolina'),
  ...Array(2).fill('comisionBancaria'),
  ...Array(2).fill('compraCredito'),
  ...Array(2).fill('pagoProveedor'),
  ...Array(3).fill('traspasoBancos'),
  ...Array(3).fill('acumulacionGasto'),
  ...Array(2).fill('pagoAcreedor'),
  ...Array(1).fill('ajusteComision'),
  ...Array(1).fill('ajusteCaja'),
];

const POLIZAS_POR_MES = PLAN_MENSUAL.length; // 30
const BORRADOR_POR_MES = 3;

// ─── Generación ──────────────────────────────────────────────

async function generarPolizasDelEjercicio(
  cfg: Config,
  rng: SeededRng,
  cuentaIdPorCodigo: Map<string, number>,
  conceptoIdPorNombre: Map<string, number>,
  tipoIdPorIdentificador: Record<TipoPolizaIdentificador, number>,
  usuarioId: number | null
): Promise<{ creadas: number; aplicadas: number; borrador: number }> {
  let creadas = 0;
  let aplicadas = 0;
  let borrador = 0;
  let seqGlobal = 0;

  for (let periodo = 1; periodo <= 12; periodo++) {
    const indicesBorrador = new Set<number>();
    while (indicesBorrador.size < BORRADOR_POR_MES) {
      indicesBorrador.add(rng.int(0, POLIZAS_POR_MES - 1));
    }

    for (let i = 0; i < PLAN_MENSUAL.length; i++) {
      seqGlobal++;
      const plantilla = PLANTILLAS[PLAN_MENSUAL[i]];
      const spec = plantilla(rng);
      const dia = rng.int(1, 28);
      const fecha = `${cfg.ejercicio}-${pad(periodo, 2)}-${pad(dia, 2)}`;
      const referencia = `${REF_PREFIX}${cfg.ejercicio}-${spec.refTag}-${pad(seqGlobal, 4)}`;
      const observaciones = `Seed demo contabilidad empresa ${EMPRESA_ID} ejercicio ${cfg.ejercicio}. ${spec.obsTexto}.`;
      const estatus: 'aplicada' | 'borrador' = indicesBorrador.has(i) ? 'borrador' : 'aplicada';

      const movimientos: PolizaMovimientoInput[] = spec.movimientos.map((m) => ({
        cuenta_id: cuentaIdPorCodigo.get(m.cuenta)!,
        concepto_id: m.concepto ? conceptoIdPorNombre.get(m.concepto.toLowerCase()) ?? null : null,
        cargo: m.cargo,
        abono: m.abono,
      }));

      await crearPolizaConMovimientos(
        EMPRESA_ID,
        {
          tipo_poliza_id: tipoIdPorIdentificador[spec.tipo],
          fecha,
          referencia,
          observaciones,
          estatus,
          movimientos,
        },
        usuarioId
      );

      creadas++;
      if (estatus === 'aplicada') aplicadas++;
      else borrador++;
    }
    console.log(`  Periodo ${pad(periodo, 2)}: ${POLIZAS_POR_MES} pólizas generadas (${POLIZAS_POR_MES - BORRADOR_POR_MES} aplicadas, ${BORRADOR_POR_MES} borrador)`);
  }

  return { creadas, aplicadas, borrador };
}

// ─── Resumen final (solo lectura) ────────────────────────────

async function imprimirResumen(ejercicio: number): Promise<void> {
  const { rows: porMes } = await pool.query(
    `SELECT p.periodo, COUNT(*) AS total,
            COUNT(*) FILTER (WHERE p.estatus = 'aplicada') AS aplicadas,
            COUNT(*) FILTER (WHERE p.estatus = 'borrador') AS borrador
       FROM contabilidad.polizas p
      WHERE p.empresa_id = $1 AND p.ejercicio = $2 AND p.referencia LIKE $3
      GROUP BY p.periodo ORDER BY p.periodo`,
    [EMPRESA_ID, ejercicio, `${REF_PREFIX}%`]
  );

  const { rows: totales } = await pool.query(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(total_cargos),0) AS cargos,
            COALESCE(SUM(total_abonos),0) AS abonos
       FROM contabilidad.polizas
      WHERE empresa_id = $1 AND ejercicio = $2 AND referencia LIKE $3`,
    [EMPRESA_ID, ejercicio, `${REF_PREFIX}%`]
  );

  const { rows: saldos } = await pool.query(
    `SELECT COUNT(*) AS filas FROM contabilidad.cuentas_saldos_mensuales
      WHERE empresa_id = $1 AND ejercicio = $2`,
    [EMPRESA_ID, ejercicio]
  );

  console.log('\n' + '='.repeat(64));
  console.log(` RESUMEN — SEED CONTABILIDAD DEMO — empresa_id=${EMPRESA_ID} — ejercicio ${ejercicio}`);
  console.log('='.repeat(64));
  for (const r of porMes) {
    console.log(`  Periodo ${pad(Number(r.periodo), 2)}: ${r.total} pólizas (${r.aplicadas} aplicadas / ${r.borrador} borrador)`);
  }
  console.log('-'.repeat(64));
  console.log(` Total pólizas demo:        ${totales[0].total}`);
  console.log(` Total cargos:              $${Number(totales[0].cargos).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
  console.log(` Total abonos:              $${Number(totales[0].abonos).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
  console.log(` Cuadre global:             ${Number(totales[0].cargos) === Number(totales[0].abonos) ? 'OK (cargos = abonos)' : 'REVISAR'}`);
  console.log(` Filas en cuentas_saldos_mensuales (ejercicio completo): ${saldos[0].filas}`);
  console.log('='.repeat(64));
}

// ─── MAIN ────────────────────────────────────────────────────

async function main() {
  const cfg = parseCLI();
  validarSeguridad(cfg);

  console.log('SEED DEMO CONTABILIDAD — empresa_id=8');
  console.log(`Ejercicio: ${cfg.ejercicio} | limpiar: ${cfg.limpiar} | seed rng: ${cfg.seed}`);
  console.log('-'.repeat(64));

  await obtenerEmpresaOFallar();
  await validarConfiguracionOFallar();
  const tipoIdPorIdentificador = await obtenerTiposPolizaOFallar();
  const usuarioId = await obtenerUsuarioDemo();

  if (cfg.limpiar) {
    await limpiarDemoPrevio(cfg.ejercicio);
  } else {
    await abortarSiHayDemoPrevio(cfg.ejercicio);
  }

  console.log('\nCreando/reutilizando catálogo de cuentas demo...');
  const cuentaIdPorCodigo = await obtenerOCrearCuentasDemo();

  const conceptoIdPorNombre = await obtenerConceptos();

  console.log('\nGenerando pólizas por mes...');
  const rng = new SeededRng(cfg.seed);
  const { creadas, aplicadas, borrador } = await generarPolizasDelEjercicio(
    cfg,
    rng,
    cuentaIdPorCodigo,
    conceptoIdPorNombre,
    tipoIdPorIdentificador,
    usuarioId
  );

  console.log(`\nPólizas creadas: ${creadas} (aplicadas: ${aplicadas}, borrador: ${borrador})`);

  await imprimirResumen(cfg.ejercicio);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('\nERROR — el seed se detuvo:');
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
    return pool.end();
  });
