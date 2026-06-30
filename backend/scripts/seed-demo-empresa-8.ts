#!/usr/bin/env ts-node
/**
 * Generador de datos demo — empresa_id = 8
 *
 * Uso:
 *   cd backend
 *   npx ts-node --compiler-options '{"target":"ES2020","module":"commonjs","esModuleInterop":true,"strict":true,"skipLibCheck":true}' scripts/seed-demo-empresa-8.ts [--opcion=valor]
 *
 * Opciones:
 *   --desde=YYYY-MM-DD              (default: 2025-12-01)
 *   --hasta=YYYY-MM-DD              (default: 2026-06-30)
 *   --ventas=N                      (default: 80)
 *   --compras=N                     (default: 70)
 *   --limpiar=true|false            (default: true)
 *   --minMovimientosPorProducto=N   (default: 4)
 *   --productosAltaRotacion=N       (default: 12)
 *   --seed=STRING                   (default: demo-empresa-8)
 *
 * SEGURIDAD: Opera EXCLUSIVAMENTE sobre empresa_id = 8.
 */

import { Pool, PoolClient } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

// ─── Constantes de seguridad — inmutables ───────────────────
const EMPRESA_ID     = 8;
const USUARIO_ID     = 1;
const CUENTA_ID      = 9;
const IVA_TASA       = 0.16;
const IVA_ID         = 'iva_16';
const CONCEPTO_VENTA  = 64;
const CONCEPTO_COMPRA = 66;

// ─── CLI ────────────────────────────────────────────────────

interface Config {
  desde: string;
  hasta: string;
  ventas: number;
  compras: number;
  limpiar: boolean;
  minMovimientosPorProducto: number;
  productosAltaRotacion: number;
  seed: string;
}

function parseCLI(): Config {
  const args = process.argv.slice(2);
  const get = (key: string, def: string): string => {
    const a = args.find(x => x.startsWith(`--${key}=`));
    return a ? a.slice(key.length + 3) : def;
  };
  return {
    desde:                    get('desde',    '2025-12-01'),
    hasta:                    get('hasta',    '2026-06-30'),
    ventas:                   Number(get('ventas',   '80')),
    compras:                  Number(get('compras',  '70')),
    limpiar:                  get('limpiar',  'true') !== 'false',
    minMovimientosPorProducto:Number(get('minMovimientosPorProducto', '4')),
    productosAltaRotacion:    Number(get('productosAltaRotacion', '12')),
    seed:                     get('seed', 'demo-empresa-8'),
  };
}

function validarConfig(cfg: Config, meses: [number, number][]) {
  const re = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  if (!re.test(cfg.desde)) throw new Error(`--desde "${cfg.desde}" no es YYYY-MM-DD válida`);
  if (!re.test(cfg.hasta)) throw new Error(`--hasta "${cfg.hasta}" no es YYYY-MM-DD válida`);
  if (cfg.desde > cfg.hasta) throw new Error('--desde debe ser <= --hasta');
  if (meses.length < 1) throw new Error('El rango debe cubrir al menos 1 mes');
  if (cfg.ventas < 1) throw new Error('--ventas debe ser >= 1');
  if (cfg.compras < 1) throw new Error('--compras debe ser >= 1');
}

// ─── RNG con semilla (xorshift32 + FNV-1a) ──────────────────

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
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 0x100000000;
  }
  int(min: number, max: number): number {
    if (min > max) [min, max] = [max, min];
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick<T>(arr: readonly T[]): T { return arr[this.int(0, arr.length - 1)] as T; }
}

// ─── Fechas (sin toISOString para fechas civiles) ───────────

function d(y: number, m: number, day: number): string {
  return `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function ts(y: number, m: number, day: number): string {
  return `${d(y,m,day)} 12:00:00-06`;
}
function addDays(fechaStr: string, dias: number): string {
  const parts = fechaStr.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + dias));
  return d(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}
function diasEnMes(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function generarMeses(desde: string, hasta: string): [number, number][] {
  const dp = desde.split('-').map(Number) as [number, number, number];
  const hp = hasta.split('-').map(Number) as [number, number, number];
  const meses: [number, number][] = [];
  let y = dp[0], m = dp[1];
  while (y < hp[0] || (y === hp[0] && m <= hp[1])) {
    meses.push([y, m]);
    m++; if (m > 12) { m = 1; y++; }
  }
  return meses;
}
function distribuirEnMeses(total: number, numMeses: number): number[] {
  const base = Math.floor(total / numMeses);
  const extra = total % numMeses;
  return Array.from({ length: numMeses }, (_, i) => base + (i < extra ? 1 : 0));
}

// ─── Seguimiento en memoria ──────────────────────────────────

const memExist = new Map<string, number>(); // `${prodId}-${almId}` → qty
const memMovs  = new Map<number, number>(); // productoId → nMovimientos

function getExist(prodId: number, almId: number): number {
  return memExist.get(`${prodId}-${almId}`) ?? 0;
}
function adjExist(prodId: number, almId: number, delta: number) {
  const k = `${prodId}-${almId}`;
  memExist.set(k, (memExist.get(k) ?? 0) + delta);
}
function addMov(prodId: number) {
  memMovs.set(prodId, (memMovs.get(prodId) ?? 0) + 1);
}

// ─── Catálogos ───────────────────────────────────────────────

const ALMACENES_DEF = [
  { clave: 'GRAL',    nombre: 'Almacén General',         tipo: 'normal'   },
  { clave: 'TIENDA',  nombre: 'Tienda / Punto de Venta', tipo: 'normal'   },
  { clave: 'TRANSIT', nombre: 'Almacén de Tránsito',     tipo: 'transito' },
];
const UNIDADES_DEF = [
  { clave: 'PZA',  descripcion: 'Pieza'     },
  { clave: 'CAJA', descripcion: 'Caja'      },
  { clave: 'LT',   descripcion: 'Litro'     },
  { clave: 'KG',   descripcion: 'Kilogramo' },
  { clave: 'MT',   descripcion: 'Metro'     },
];

interface ProvDef { nombre: string; rfc: string; }
const PROVEEDORES_DEF: ProvDef[] = [
  { nombre: 'Distribuidora Nacional S.A. de C.V.',       rfc: 'DNA850320ABC' },
  { nombre: 'Importaciones del Norte S.A. de C.V.',       rfc: 'INO920615DEF' },
  { nombre: 'Proveedora de Oficinas PROMED S.A.',          rfc: 'POF910428GHI' },
  { nombre: 'Suministros Industriales García S.A.',        rfc: 'SIG830715JKL' },
  { nombre: 'Materiales y Equipos MEQ S.A.',               rfc: 'MEM900210MNO' },
  { nombre: 'Tecnología y Sistemas TECSIS S.A.',           rfc: 'TST950805PQR' },
  { nombre: 'Consumibles del Centro S.A.',                 rfc: 'CDC880312STU' },
  { nombre: 'Herramientas y Refacciones HRSA S.A.',        rfc: 'HYR870620VWX' },
  { nombre: 'Insumos de Limpieza INLIM S.A.',              rfc: 'ILI910415YZA' },
  { nombre: 'Electrocomponentes ELCOM S.A.',               rfc: 'EEC930120BCD' },
  { nombre: 'Papelería y Arte PAPARTE S.A.',               rfc: 'PAP801215EFG' },
  { nombre: 'Equipos Pequeños EQUISMA S.A.',               rfc: 'EPS940308HIJ' },
];

interface CliDef { nombre: string; rfc: string; dias_credito: number; limite: number; }
const CLIENTES_DEF: CliDef[] = [
  { nombre: 'Corporativo TechMex S.A. de C.V.',         rfc: 'CTM970801KLM', dias_credito: 30, limite: 500000 },
  { nombre: 'Grupo Empresarial Norte S.A. de C.V.',     rfc: 'GEN850602NOP', dias_credito: 30, limite: 300000 },
  { nombre: 'Comercializadora del Pacífico S.A.',       rfc: 'CPA910718QRS', dias_credito: 15, limite: 200000 },
  { nombre: 'Industrias Jalisco S.A. de C.V.',          rfc: 'IJA880325TUV', dias_credito: 45, limite: 400000 },
  { nombre: 'Oficinas Modernas del Golfo S.A.',         rfc: 'OMG920410WXY', dias_credito: 30, limite: 150000 },
  { nombre: 'Constructora y Edificadora S.A. de C.V.',  rfc: 'CED870915ZAB', dias_credito: 60, limite: 600000 },
  { nombre: 'Servicios Administrativos del Sur S.C.',   rfc: 'SAS930801CDE', dias_credito: 30, limite: 100000 },
  { nombre: 'Distribuidora Metropolitana S.A.',         rfc: 'DIM890220FGH', dias_credito: 30, limite: 250000 },
  { nombre: 'Logística Express S.A. de C.V.',           rfc: 'LEX960512IJK', dias_credito: 15, limite: 180000 },
  { nombre: 'Farmacéutica Central S.A. de C.V.',        rfc: 'FAC910630LMN', dias_credito: 45, limite: 350000 },
  { nombre: 'Cadena Restaurantes MW S.A. de C.V.',      rfc: 'CRM880120OPQ', dias_credito: 30, limite: 200000 },
  { nombre: 'Centro Educativo Privado S.C.',            rfc: 'CEP950815RST', dias_credito: 30, limite: 120000 },
  { nombre: 'Hospital Regional del Valle S.A.',         rfc: 'HRV900408UVW', dias_credito: 45, limite: 500000 },
  { nombre: 'Agencia de Viajes Internacional S.A.',     rfc: 'AVI930215XYZ', dias_credito: 15, limite: 100000 },
  { nombre: 'Manufactura Ligera del Norte S.A.',        rfc: 'MLN870620ABC', dias_credito: 30, limite: 280000 },
  { nombre: 'Comercio Electrónico MX S.A. de C.V.',    rfc: 'CEM010305DEF', dias_credito: 15, limite:  80000 },
  { nombre: 'Consultora de Negocios BCG S.C.',          rfc: 'CNB920710GHI', dias_credito: 30, limite: 150000 },
  { nombre: 'Inmobiliaria Patrimonial S.A.',            rfc: 'IPA880925JKL', dias_credito: 45, limite: 200000 },
  { nombre: 'Productora de Medios PM S.A. de C.V.',    rfc: 'PMP970415MNO', dias_credito: 30, limite: 120000 },
  { nombre: 'Startup Tecnológica DX S.A.',              rfc: 'STD100820PQR', dias_credito:  0, limite:  50000 },
];

interface ProdDef {
  clave: string; descripcion: string; tipo: string; familia: string;
  costo: number; precio: number; minimo: number; provIdx: number;
}
// Los primeros 12 productos son "alta rotación" por default
const PRODUCTOS_DEF: ProdDef[] = [
  { clave:'P001', descripcion:'Resma papel bond 75g carta c/500 hojas',       tipo:'Consumible',  familia:'Oficina',       costo:  350, precio:  545, minimo:  5, provIdx: 2 },
  { clave:'P002', descripcion:'Tóner HP 85A negro CE285A',                     tipo:'Consumible',  familia:'Oficina',       costo:  980, precio: 1450, minimo:  3, provIdx: 0 },
  { clave:'P003', descripcion:'Tóner HP 305A cian CE411A',                     tipo:'Consumible',  familia:'Oficina',       costo:  750, precio: 1100, minimo:  2, provIdx: 0 },
  { clave:'P004', descripcion:'Tóner HP 305A magenta CE413A',                  tipo:'Consumible',  familia:'Oficina',       costo:  750, precio: 1100, minimo:  2, provIdx: 0 },
  { clave:'P005', descripcion:'Tóner HP 305A amarillo CE412A',                 tipo:'Consumible',  familia:'Oficina',       costo:  750, precio: 1100, minimo:  2, provIdx: 0 },
  { clave:'P006', descripcion:'Bolígrafos BIC cristal azul caja c/12',         tipo:'Consumible',  familia:'Oficina',       costo:   45, precio:   72, minimo: 10, provIdx:10 },
  { clave:'P007', descripcion:'Archivero metálico 4 cajones gris',             tipo:'Producto',    familia:'Oficina',       costo: 2800, precio: 4200, minimo:  2, provIdx: 4 },
  { clave:'P008', descripcion:'Engrapadora industrial Swingline 747',          tipo:'Producto',    familia:'Oficina',       costo:  320, precio:  495, minimo:  3, provIdx: 4 },
  { clave:'P009', descripcion:'Perforadora 3 hoyos metálica 40 hojas',        tipo:'Producto',    familia:'Oficina',       costo:  185, precio:  280, minimo:  3, provIdx: 4 },
  { clave:'P010', descripcion:'Folders manila carta c/100 piezas',             tipo:'Consumible',  familia:'Oficina',       costo:   78, precio:  120, minimo: 10, provIdx:10 },
  { clave:'P011', descripcion:'USB Flash Drive 16GB Kingston DataTraveler',    tipo:'Producto',    familia:'Tecnología',    costo:   85, precio:  140, minimo: 10, provIdx: 5 },
  { clave:'P012', descripcion:'Mouse óptico Logitech M110 USB negro',          tipo:'Producto',    familia:'Tecnología',    costo:  145, precio:  230, minimo:  5, provIdx: 5 },
  { clave:'P013', descripcion:'Teclado USB estándar Logitech K120',            tipo:'Producto',    familia:'Tecnología',    costo:  195, precio:  295, minimo:  5, provIdx: 5 },
  { clave:'P014', descripcion:'Foco LED 9W cálido paq. c/12 piezas',          tipo:'Consumible',  familia:'Mantenimiento', costo:  420, precio:  650, minimo:  6, provIdx: 9 },
  { clave:'P015', descripcion:'Pilas alcalinas AA Duracell paq. c/24',         tipo:'Consumible',  familia:'Mantenimiento', costo:   95, precio:  150, minimo: 10, provIdx: 9 },
  { clave:'P016', descripcion:'Cinta adhesiva 48mm 3M paq. c/12 rollos',      tipo:'Consumible',  familia:'Embalaje',      costo:  145, precio:  225, minimo:  6, provIdx: 6 },
  { clave:'P017', descripcion:'Marcadores permanentes Sharpie c/12 piezas',   tipo:'Consumible',  familia:'Oficina',       costo:  125, precio:  195, minimo:  5, provIdx:10 },
  { clave:'P018', descripcion:'Post-it 3x3 colores surtidos c/12 blocs',      tipo:'Consumible',  familia:'Oficina',       costo:  185, precio:  285, minimo:  5, provIdx:10 },
  { clave:'P019', descripcion:'Set desarmadores precisión 10 piezas',         tipo:'Herramienta', familia:'Herramientas',  costo:  245, precio:  375, minimo:  3, provIdx: 7 },
  { clave:'P020', descripcion:'Llave ajustable 12 pulgadas Stanley',           tipo:'Herramienta', familia:'Herramientas',  costo:  285, precio:  440, minimo:  3, provIdx: 7 },
  { clave:'P021', descripcion:'Taladro inalámbrico 18V DeWalt DCD771',         tipo:'Herramienta', familia:'Herramientas',  costo: 2450, precio: 3800, minimo:  2, provIdx: 7 },
  { clave:'P022', descripcion:'Extensión eléctrica 10m 4 contactos',           tipo:'Herramienta', familia:'Mantenimiento', costo:  185, precio:  280, minimo:  3, provIdx: 9 },
  { clave:'P023', descripcion:'Cinturón porta herramientas nylon 6 bolsillos', tipo:'Herramienta', familia:'Herramientas',  costo:  165, precio:  250, minimo:  3, provIdx: 7 },
  { clave:'P024', descripcion:'Set cutters profesionales c/5 piezas',          tipo:'Herramienta', familia:'Herramientas',  costo:  125, precio:  190, minimo:  5, provIdx: 7 },
  { clave:'P025', descripcion:'Cinta métrica 5m autoblocante Stanley',         tipo:'Herramienta', familia:'Herramientas',  costo:   95, precio:  148, minimo:  5, provIdx: 7 },
  { clave:'P026', descripcion:'Martillo carpintero 16oz mango de fibra',       tipo:'Herramienta', familia:'Herramientas',  costo:  145, precio:  225, minimo:  3, provIdx: 7 },
  { clave:'P027', descripcion:'Jabón líquido industrial balde 20 litros',     tipo:'Consumible',  familia:'Limpieza',      costo:  320, precio:  498, minimo:  3, provIdx: 8 },
  { clave:'P028', descripcion:'Cloro concentrado 5.25% garrafa 5 litros',     tipo:'Consumible',  familia:'Limpieza',      costo:   85, precio:  132, minimo:  8, provIdx: 8 },
  { clave:'P029', descripcion:'Desengrasante multiusos industrial 4 litros',   tipo:'Consumible',  familia:'Limpieza',      costo:  145, precio:  225, minimo:  6, provIdx: 8 },
  { clave:'P030', descripcion:'Escoba industrial mango largo 1.5m',            tipo:'Producto',    familia:'Limpieza',      costo:  125, precio:  192, minimo:  4, provIdx: 8 },
  { clave:'P031', descripcion:'Trapos industriales algodón bolsa 5kg',         tipo:'Consumible',  familia:'Limpieza',      costo:  185, precio:  285, minimo:  6, provIdx: 8 },
  { clave:'P032', descripcion:'Guantes látex desechables M caja c/100 pzas',  tipo:'Consumible',  familia:'Limpieza',      costo:  125, precio:  192, minimo:  8, provIdx: 8 },
  { clave:'P033', descripcion:'Bolsa basura negra 90x120cm rollo c/10 pzas',  tipo:'Consumible',  familia:'Limpieza',      costo:   95, precio:  148, minimo: 10, provIdx: 6 },
  { clave:'P034', descripcion:'Desodorante ambiental lavanda 750ml c/6 pzas', tipo:'Consumible',  familia:'Limpieza',      costo:  145, precio:  225, minimo:  6, provIdx: 8 },
  { clave:'P035', descripcion:'Calculadora científica Casio FX-991LA Plus',    tipo:'Producto',    familia:'Equipo',        costo:  285, precio:  440, minimo:  3, provIdx:11 },
  { clave:'P036', descripcion:'Sumadora de escritorio 12 dígitos c/papel',     tipo:'Producto',    familia:'Equipo',        costo:  385, precio:  595, minimo:  3, provIdx:11 },
  { clave:'P037', descripcion:'Reloj de pared analógico con fecha',             tipo:'Producto',    familia:'Equipo',        costo:  165, precio:  255, minimo:  3, provIdx:11 },
  { clave:'P038', descripcion:'Ventilador de pie 18 pulgadas 3 velocidades',   tipo:'Producto',    familia:'Equipo',        costo:  845, precio: 1295, minimo:  3, provIdx:11 },
  { clave:'P039', descripcion:'Dispensador de agua fría y caliente vertical',   tipo:'Producto',    familia:'Equipo',        costo: 2850, precio: 4400, minimo:  1, provIdx:11 },
  { clave:'P040', descripcion:'Cafetera eléctrica 12 tazas filtro permanente', tipo:'Producto',    familia:'Equipo',        costo:  485, precio:  750, minimo:  2, provIdx:11 },
];

// ─── Tipos internos ──────────────────────────────────────────

interface Almacen  { id: number; clave: string; }
interface Unidad   { id: number; clave: string; }
interface Contacto { id: number; nombre: string; diasCredito?: number; }
interface Producto { id: number; clave: string; costo: number; precio: number; minimo: number; }
interface MovPartida {
  producto_id: number; almacen_id: number; cantidad: number; signo: number;
  costo_unitario?: number; tipo_partida?: string; almacen_destino_id?: number;
}
interface PartidaOpts {
  documento_id: number; numero: number; producto_id: number; cantidad: number;
  precio_unitario: number; subtotal_partida: number; total_partida: number;
  iva_monto: number; almacen_id?: number;
}

// ─── Pool ────────────────────────────────────────────────────

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// ─── Helpers BD ──────────────────────────────────────────────

function round2(n: number): number { return Math.round(n * 100) / 100; }

async function nextNumero(c: PoolClient, tipo: string, serie: string): Promise<number> {
  const { rows } = await c.query<{ ultimo_numero: number }>(
    `UPDATE series_documento SET ultimo_numero = ultimo_numero + 1, updated_at = now()
      WHERE empresa_id = $1 AND tipo_documento = $2 AND serie = $3 RETURNING ultimo_numero`,
    [EMPRESA_ID, tipo, serie],
  );
  if (rows.length) return rows[0].ultimo_numero;
  await c.query(
    `INSERT INTO series_documento(empresa_id, tipo_documento, serie, activa, ultimo_numero)
     VALUES($1,$2,$3,true,1)
     ON CONFLICT(empresa_id, tipo_documento, serie)
     DO UPDATE SET ultimo_numero = series_documento.ultimo_numero + 1, updated_at = now()`,
    [EMPRESA_ID, tipo, serie],
  );
  const { rows: r2 } = await c.query<{ ultimo_numero: number }>(
    `SELECT ultimo_numero FROM series_documento WHERE empresa_id=$1 AND tipo_documento=$2 AND serie=$3`,
    [EMPRESA_ID, tipo, serie],
  );
  return r2[0]?.ultimo_numero ?? 1;
}

async function insertDocumento(c: PoolClient, opts: {
  tipo_documento: string; serie: string; numero: number;
  fecha_documento: string; fecha_vencimiento?: string;
  contacto_id: number; almacen_id?: number;
  subtotal: number; iva: number; total: number;
  estatus_documento: string; concepto_id: number;
}): Promise<number> {
  const { rows } = await c.query<{ id: number }>(
    `INSERT INTO documentos
       (empresa_id, tipo_documento, serie, numero, fecha_documento, fecha_vencimiento,
        contacto_principal_id, almacen_id, subtotal, iva, total, saldo,
        estatus_documento, estado_seguimiento, estado_autorizacion,
        moneda, tratamiento_impuestos, concepto_id, usuario_creacion_id)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
            'borrador','no_requerida','MXN','normal',$14,$15)
     RETURNING id`,
    [EMPRESA_ID, opts.tipo_documento, opts.serie, opts.numero,
     opts.fecha_documento, opts.fecha_vencimiento ?? null,
     opts.contacto_id, opts.almacen_id ?? null,
     opts.subtotal, opts.iva, opts.total, opts.total,
     opts.estatus_documento, opts.concepto_id, USUARIO_ID],
  );
  return rows[0].id;
}

async function insertPartida(c: PoolClient, p: PartidaOpts): Promise<number> {
  const { rows } = await c.query<{ id: number }>(
    `INSERT INTO documentos_partidas
       (documento_id, numero_partida, producto_id, cantidad, precio_unitario,
        subtotal_partida, total_partida, iva_porcentaje, iva_monto, almacen_id, es_parte_oportunidad)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false) RETURNING id`,
    [p.documento_id, p.numero, p.producto_id, p.cantidad, p.precio_unitario,
     p.subtotal_partida, p.total_partida, IVA_TASA, p.iva_monto, p.almacen_id ?? null],
  );
  return rows[0].id;
}

async function insertImpuesto(c: PoolClient, partidaId: number, base: number, monto: number) {
  await c.query(
    `INSERT INTO documentos_partidas_impuestos(partida_id, impuesto_id, tasa, base, monto) VALUES($1,$2,$3,$4,$5)`,
    [partidaId, IVA_ID, IVA_TASA, base, monto],
  );
}

async function aplicarMovimiento(
  c: PoolClient, tipoMov: string, fechaTs: string,
  documentoId: number | null, partidas: MovPartida[], obs?: string,
): Promise<bigint> {
  const { rows } = await c.query<{ aplicar_movimiento: bigint }>(
    `SELECT inventario.aplicar_movimiento($1,$2,$3,$4,$5,$6,$7) AS aplicar_movimiento`,
    [EMPRESA_ID, tipoMov, fechaTs, USUARIO_ID, documentoId, obs ?? null, JSON.stringify(partidas)],
  );
  for (const p of partidas) {
    adjExist(p.producto_id, p.almacen_id, p.signo * p.cantidad);
    addMov(p.producto_id);
  }
  return rows[0].aplicar_movimiento;
}

async function insertFinanzasOp(c: PoolClient, opts: {
  fecha: string; tipo_movimiento: string; monto: number;
  contacto_id: number; documento_origen_id: number;
  naturaleza_operacion: string; concepto_id: number;
}): Promise<number> {
  const { rows } = await c.query<{ id: number }>(
    `INSERT INTO finanzas_operaciones
       (empresa_id, fecha, tipo_movimiento, monto, cuenta_id, contacto_id,
        documento_origen_id, naturaleza_operacion, concepto_id, estado_conciliacion, created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendiente',$10) RETURNING id`,
    [EMPRESA_ID, opts.fecha, opts.tipo_movimiento, opts.monto, CUENTA_ID,
     opts.contacto_id, opts.documento_origen_id, opts.naturaleza_operacion, opts.concepto_id, USUARIO_ID],
  );
  return rows[0].id;
}

async function insertAplicacion(c: PoolClient, opId: number, docDestinoId: number, monto: number) {
  await c.query(
    `INSERT INTO aplicaciones_saldo
       (empresa_id, finanzas_operacion_id, documento_destino_id, monto, monto_moneda_documento, created_by)
     VALUES($1,$2,$3,$4,$4,$5)`,
    [EMPRESA_ID, opId, docDestinoId, monto, USUARIO_ID],
  );
}

// ─── Selección de productos con ponderación ──────────────────

function selectProductos(
  rng: SeededRng, productos: Producto[],
  altaRotN: number, count: number, exclude: Set<number> = new Set(),
): Producto[] {
  const highRot = productos.slice(0, Math.min(altaRotN, productos.length));
  const result: Producto[] = [];
  const usados = new Set(exclude);
  for (let att = 0; result.length < count && att < count * 5; att++) {
    let pool: Producto[];
    if (rng.next() < 0.60 && highRot.some(p => !usados.has(p.id))) {
      pool = highRot.filter(p => !usados.has(p.id));
    } else {
      pool = productos.filter(p => !usados.has(p.id));
    }
    if (pool.length === 0) break;
    const prod = pool[rng.int(0, pool.length - 1)] as Producto;
    result.push(prod);
    usados.add(prod.id);
  }
  return result;
}

function selectConStock(
  rng: SeededRng, productos: Producto[], altaRotN: number,
  count: number, almacenId: number, minStock = 2,
): Producto[] {
  const conStock = productos.filter(p => getExist(p.id, almacenId) >= minStock);
  if (conStock.length === 0) return [];
  return selectProductos(rng, conStock, Math.min(altaRotN, conStock.length), count, new Set());
}

// ─── Limpieza ────────────────────────────────────────────────

async function cleanup(c: PoolClient) {
  console.log('  → Limpiando datos previos de empresa 8...');
  await c.query(`DELETE FROM finanzas_programacion_pagos_detalle WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM finanzas_programacion_pagos WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM finanzas_conciliaciones_operaciones fco
    USING finanzas_conciliaciones fc WHERE fco.conciliacion_id=fc.id AND fc.empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM finanzas_conciliaciones WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM aplicaciones_saldo WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM finanzas_transferencias WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`UPDATE documentos SET finanzas_operacion_id=NULL WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM finanzas_operaciones WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM credito_operaciones_aplicaciones WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM credito_operaciones_items coi
    USING credito_operaciones co WHERE coi.operacion_credito_id=co.id AND co.empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM credito_operaciones WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM inventario.movimientos_partidas WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM inventario.movimientos WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM inventario.existencias WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM autorizaciones_solicitudes WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM documentos_cancelacion_intentos dci
    USING documentos d WHERE dci.documento_id=d.id AND d.empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM documentos_partidas_impuestos dpi
    USING documentos_partidas dp JOIN documentos doc ON doc.id=dp.documento_id
    WHERE dpi.partida_id=dp.id AND doc.empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM documentos_partidas_campos WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM documentos_partidas_vinculos WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM documentos_partidas dp
    USING documentos d WHERE dp.documento_id=d.id AND d.empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM documentos_campos WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM documentos_cfdi dc
    USING documentos d WHERE dc.documento_id=d.id AND d.empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM documentos WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM crm.actividades WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM crm.oportunidades_venta WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM contactos_datos_fiscales cdf
    USING contactos c WHERE cdf.contacto_id=c.id AND c.empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM contactos_domicilios cd
    USING contactos c WHERE cd.contacto_id=c.id AND c.empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM contactos WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM precios WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM precios_listas WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM productos_impuestos pi2
    USING productos p WHERE pi2.producto_id=p.id AND p.empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM productos WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM unidades WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`DELETE FROM inventario.almacenes WHERE empresa_id=$1`, [EMPRESA_ID]);
  await c.query(`UPDATE series_documento SET ultimo_numero=0, updated_at=now() WHERE empresa_id=$1`, [EMPRESA_ID]);
  console.log('    ✓ Limpieza completada');
}

// ─── Crear catálogos ─────────────────────────────────────────

async function crearAlmacenes(c: PoolClient): Promise<Almacen[]> {
  const result: Almacen[] = [];
  for (const a of ALMACENES_DEF) {
    const { rows } = await c.query<{ id: number }>(
      `INSERT INTO inventario.almacenes(empresa_id,clave,nombre,tipo) VALUES($1,$2,$3,$4) RETURNING id`,
      [EMPRESA_ID, a.clave, a.nombre, a.tipo],
    );
    result.push({ id: rows[0].id, clave: a.clave });
  }
  console.log(`    ✓ ${result.length} almacenes creados`);
  return result;
}

async function crearUnidades(c: PoolClient): Promise<Unidad[]> {
  const result: Unidad[] = [];
  for (const u of UNIDADES_DEF) {
    const { rows } = await c.query<{ id: number }>(
      `INSERT INTO unidades(clave,descripcion,unidad_sat_id,empresa_id,activo) VALUES($1,$2,2,$3,true) RETURNING id`,
      [u.clave, u.descripcion, EMPRESA_ID],
    );
    result.push({ id: rows[0].id, clave: u.clave });
  }
  console.log(`    ✓ ${result.length} unidades creadas`);
  return result;
}

async function crearProveedores(c: PoolClient): Promise<Contacto[]> {
  const result: Contacto[] = [];
  for (const p of PROVEEDORES_DEF) {
    const { rows } = await c.query<{ id: number }>(
      `INSERT INTO contactos(empresa_id,tipo_contacto,nombre,rfc,activo,dias_credito)
       VALUES($1,'Proveedor',$2,$3,true,30) RETURNING id`,
      [EMPRESA_ID, p.nombre, p.rfc],
    );
    result.push({ id: rows[0].id, nombre: p.nombre, diasCredito: 30 });
  }
  console.log(`    ✓ ${result.length} proveedores creados`);
  return result;
}

async function crearClientes(c: PoolClient): Promise<Contacto[]> {
  const result: Contacto[] = [];
  for (const cl of CLIENTES_DEF) {
    const { rows } = await c.query<{ id: number }>(
      `INSERT INTO contactos(empresa_id,tipo_contacto,nombre,rfc,activo,dias_credito,limite_credito)
       VALUES($1,'Cliente',$2,$3,true,$4,$5) RETURNING id`,
      [EMPRESA_ID, cl.nombre, cl.rfc, cl.dias_credito, cl.limite],
    );
    result.push({ id: rows[0].id, nombre: cl.nombre, diasCredito: cl.dias_credito });
  }
  console.log(`    ✓ ${result.length} clientes creados`);
  return result;
}

async function crearProductos(c: PoolClient, unidades: Unidad[], proveedores: Contacto[]): Promise<Producto[]> {
  const pzaId = unidades.find(u => u.clave === 'PZA')!.id;
  const result: Producto[] = [];
  for (const pd of PRODUCTOS_DEF) {
    const provId = proveedores[pd.provIdx]?.id ?? null;
    const { rows } = await c.query<{ id: number }>(
      `INSERT INTO productos
         (empresa_id,clave,descripcion,tipo_producto,familia,activo,
          unidad_venta_id,unidad_inventario_id,
          costo_estandar,costo_promedio,ultimo_costo,
          precio_publico,precio_menudeo,precio_mayoreo,precio_distribuidor,
          minimo_inventario,proveedor_principal_id,proveedor_preferido_id)
       VALUES($1,$2,$3,$4,$5,true,$6,$6,$7,$7,$7,$8,$8,$8,$8,$9,$10,$10) RETURNING id`,
      [EMPRESA_ID, pd.clave, pd.descripcion, pd.tipo, pd.familia,
       pzaId, pd.costo, pd.precio, pd.minimo, provId],
    );
    result.push({ id: rows[0].id, clave: pd.clave, costo: pd.costo, precio: pd.precio, minimo: pd.minimo });
  }
  console.log(`    ✓ ${result.length} productos creados`);
  return result;
}

async function crearListasPrecios(c: PoolClient, productos: Producto[]) {
  const { rows: [{ id: listaPublico }] } = await c.query<{ id: number }>(
    `INSERT INTO precios_listas(empresa_id,nombre,tipo_precio,es_default,activo)
     VALUES($1,'Precio Público','venta',true,true) RETURNING id`, [EMPRESA_ID],
  );
  const { rows: [{ id: listaMayoreo }] } = await c.query<{ id: number }>(
    `INSERT INTO precios_listas(empresa_id,nombre,tipo_precio,es_default,activo)
     VALUES($1,'Precio Mayoreo','venta',false,true) RETURNING id`, [EMPRESA_ID],
  );
  for (const [i, p] of productos.entries()) {
    await c.query(`INSERT INTO precios(empresa_id,producto_id,precio_lista_id,precio,activo) VALUES($1,$2,$3,$4,true)`,
      [EMPRESA_ID, p.id, listaPublico, round2(p.precio * (1 + (i % 3) * 0.02))]);
    await c.query(`INSERT INTO precios(empresa_id,producto_id,precio_lista_id,precio,activo) VALUES($1,$2,$3,$4,true)`,
      [EMPRESA_ID, p.id, listaMayoreo, round2(p.precio * (1 - 0.08 - (i % 4) * 0.02))]);
  }
  console.log(`    ✓ 2 listas de precios + ${productos.length * 2} precios`);
}

async function setupSeries(c: PoolClient) {
  const series: [string, string][] = [
    ['cotizacion','COT'], ['pedido','PED'], ['remision','REM'],
    ['factura','FAC'], ['factura_compra','FCO'], ['orden_compra','OC'],
    ['recepcion','REC'], ['pago_cliente','PCL'], ['pago_proveedor','PPR'],
    ['nota_credito','NC'], ['nota_credito_compra','NCC'],
  ];
  for (const [tipo, serie] of series) {
    await c.query(
      `INSERT INTO series_documento(empresa_id,tipo_documento,serie,activa,ultimo_numero)
       VALUES($1,$2,$3,true,0) ON CONFLICT(empresa_id,tipo_documento,serie) DO NOTHING`,
      [EMPRESA_ID, tipo, serie],
    );
  }
  console.log('    ✓ Series verificadas');
}

// ─── Compras ─────────────────────────────────────────────────

async function generarCompras(
  c: PoolClient, cfg: Config, rng: SeededRng, meses: [number, number][],
  almacenes: Almacen[], proveedores: Contacto[], productos: Producto[],
): Promise<number[]> {
  const almGral = almacenes[0] as Almacen;
  const ids: number[] = [];
  const dist = distribuirEnMeses(cfg.compras, meses.length);

  for (let mi = 0; mi < meses.length; mi++) {
    const [year, month] = meses[mi] as [number, number];
    const nDias = diasEnMes(year, month);
    const nComp = dist[mi] ?? 0;
    for (let ci = 0; ci < nComp; ci++) {
      const provIdx  = rng.int(0, proveedores.length - 1);
      const dia      = rng.int(2, Math.min(nDias - 1, 26));
      const fechaDoc = d(year, month, dia);
      const numItems = rng.int(2, 4);
      const sel      = selectProductos(rng, productos, cfg.productosAltaRotacion, numItems);
      if (sel.length === 0) continue;

      const items = sel.map(prod => ({ prod, qty: rng.int(10, 35) }));
      const subtotal = round2(items.reduce((s, it) => s + it.qty * it.prod.costo, 0));
      const iva      = round2(subtotal * IVA_TASA);
      const total    = round2(subtotal + iva);

      const prov  = proveedores[provIdx] as Contacto;
      const num   = await nextNumero(c, 'factura_compra', 'FCO');
      const docId = await insertDocumento(c, {
        tipo_documento: 'factura_compra', serie: 'FCO', numero: num,
        fecha_documento: fechaDoc, fecha_vencimiento: addDays(fechaDoc, 30),
        contacto_id: prov.id, almacen_id: almGral.id,
        subtotal, iva, total, estatus_documento: 'Emitido', concepto_id: CONCEPTO_COMPRA,
      });

      const movPart: MovPartida[] = [];
      for (const [ii, item] of items.entries()) {
        const { prod, qty } = item;
        const sub = round2(qty * prod.costo);
        const ivaP = round2(sub * IVA_TASA);
        const pid = await insertPartida(c, {
          documento_id: docId, numero: ii + 1, producto_id: prod.id, cantidad: qty,
          precio_unitario: prod.costo, subtotal_partida: sub, total_partida: round2(sub + ivaP),
          iva_monto: ivaP, almacen_id: almGral.id,
        });
        await insertImpuesto(c, pid, sub, ivaP);
        movPart.push({ producto_id: prod.id, almacen_id: almGral.id, cantidad: qty, signo: 1, costo_unitario: prod.costo });
      }
      await aplicarMovimiento(c, 'compra', ts(year, month, dia), docId, movPart, `Compra FCO-${num}`);
      ids.push(docId);
    }
  }
  console.log(`    ✓ ${ids.length} facturas de compra generadas`);
  return ids;
}

// ─── Ventas (verificación de stock) ─────────────────────────

async function generarVentas(
  c: PoolClient, cfg: Config, rng: SeededRng, meses: [number, number][],
  almacenes: Almacen[], clientes: Contacto[], productos: Producto[],
): Promise<number[]> {
  const ids: number[] = [];
  const dist = distribuirEnMeses(cfg.ventas, meses.length);
  const almsVenta = almacenes.slice(0, 2); // GRAL y TIENDA

  for (let mi = 0; mi < meses.length; mi++) {
    const [year, month] = meses[mi] as [number, number];
    const nDias = diasEnMes(year, month);
    const nVenta = dist[mi] ?? 0;
    for (let vi = 0; vi < nVenta; vi++) {
      const cliIdx   = rng.int(0, clientes.length - 1);
      const alm      = almsVenta[rng.int(0, 1)] as Almacen;
      const dia      = rng.int(2, Math.min(nDias - 1, 28));
      const fechaDoc = d(year, month, dia);
      const cli      = clientes[cliIdx] as Contacto;
      const diasCred = cli.diasCredito ?? 30;
      const numItems = rng.int(2, 4);

      const sel = selectConStock(rng, productos, cfg.productosAltaRotacion, numItems, alm.id, 2);
      if (sel.length === 0) continue;

      const items = sel.map(prod => {
        const stock = getExist(prod.id, alm.id);
        const max   = Math.max(1, Math.floor(stock * 0.5));
        const qty   = rng.int(1, Math.min(max, 10));
        const var_  = 1 + rng.int(0, 8) * 0.01;
        return { prod: { ...prod, precio: round2(prod.precio * var_) }, qty };
      });

      const subtotal = round2(items.reduce((s, it) => s + it.qty * it.prod.precio, 0));
      const iva      = round2(subtotal * IVA_TASA);
      const total    = round2(subtotal + iva);

      const num   = await nextNumero(c, 'factura', 'FAC');
      const docId = await insertDocumento(c, {
        tipo_documento: 'factura', serie: 'FAC', numero: num,
        fecha_documento: fechaDoc, fecha_vencimiento: addDays(fechaDoc, diasCred > 0 ? diasCred : 30),
        contacto_id: cli.id, almacen_id: alm.id,
        subtotal, iva, total, estatus_documento: 'Emitido', concepto_id: CONCEPTO_VENTA,
      });

      const movPart: MovPartida[] = [];
      for (const [ii, item] of items.entries()) {
        const { prod, qty } = item;
        const sub  = round2(qty * prod.precio);
        const ivaP = round2(sub * IVA_TASA);
        const pid  = await insertPartida(c, {
          documento_id: docId, numero: ii + 1, producto_id: prod.id, cantidad: qty,
          precio_unitario: prod.precio, subtotal_partida: sub, total_partida: round2(sub + ivaP),
          iva_monto: ivaP, almacen_id: alm.id,
        });
        await insertImpuesto(c, pid, sub, ivaP);
        movPart.push({ producto_id: prod.id, almacen_id: alm.id, cantidad: qty, signo: -1 });
      }
      await aplicarMovimiento(c, 'venta', ts(year, month, dia), docId, movPart, `Venta FAC-${num}`);
      ids.push(docId);
    }
  }
  console.log(`    ✓ ${ids.length} facturas de venta generadas`);
  return ids;
}

// ─── Movimientos garantizados por producto ───────────────────

async function generarMovimientosGarantizados(
  c: PoolClient, cfg: Config, rng: SeededRng, meses: [number, number][],
  almacenes: Almacen[], proveedores: Contacto[], clientes: Contacto[], productos: Producto[],
): Promise<{ comprasExtra: number; ventasExtra: number }> {
  const almGral  = almacenes[0] as Almacen;
  let comprasExtra = 0;
  let ventasExtra  = 0;
  const mesIni = meses[Math.max(0, meses.length - 3)] as [number, number];
  const mesUlt = meses[meses.length - 1] as [number, number];

  for (const prod of productos) {
    const movAct = memMovs.get(prod.id) ?? 0;
    if (movAct >= cfg.minMovimientosPorProducto) continue;

    const faltantes = cfg.minMovimientosPorProducto - movAct;
    const numComprasNec = Math.ceil(faltantes / 2);

    for (let i = 0; i < numComprasNec; i++) {
      const [year, month] = (i % 2 === 0 ? mesIni : mesUlt) as [number, number];
      const dia      = rng.int(2, Math.min(diasEnMes(year, month) - 1, 24));
      const qty      = rng.int(10, 25);
      const fechaDoc = d(year, month, dia);
      const sub      = round2(qty * prod.costo);
      const ivaP     = round2(sub * IVA_TASA);
      const provId   = (proveedores[rng.int(0, proveedores.length - 1)] as Contacto).id;

      const num   = await nextNumero(c, 'factura_compra', 'FCO');
      const docId = await insertDocumento(c, {
        tipo_documento: 'factura_compra', serie: 'FCO', numero: num,
        fecha_documento: fechaDoc, fecha_vencimiento: addDays(fechaDoc, 30),
        contacto_id: provId, almacen_id: almGral.id,
        subtotal: sub, iva: ivaP, total: round2(sub + ivaP),
        estatus_documento: 'Emitido', concepto_id: CONCEPTO_COMPRA,
      });
      const pid = await insertPartida(c, {
        documento_id: docId, numero: 1, producto_id: prod.id, cantidad: qty,
        precio_unitario: prod.costo, subtotal_partida: sub, total_partida: round2(sub + ivaP),
        iva_monto: ivaP, almacen_id: almGral.id,
      });
      await insertImpuesto(c, pid, sub, ivaP);
      await aplicarMovimiento(c, 'compra', ts(year, month, dia), docId,
        [{ producto_id: prod.id, almacen_id: almGral.id, cantidad: qty, signo: 1, costo_unitario: prod.costo }],
        `Compra relleno FCO-${num}`);
      comprasExtra++;
    }

    // Si aún faltan movimientos y hay stock, agregar venta
    const movTras = memMovs.get(prod.id) ?? 0;
    if (movTras < cfg.minMovimientosPorProducto && getExist(prod.id, almGral.id) >= 3) {
      const [year, month] = mesUlt as [number, number];
      const dia      = rng.int(10, Math.min(diasEnMes(year, month) - 1, 27));
      const stock    = getExist(prod.id, almGral.id);
      const qty      = rng.int(1, Math.max(1, Math.floor(stock * 0.3)));
      const fechaDoc = d(year, month, dia);
      const sub      = round2(qty * prod.precio);
      const ivaP     = round2(sub * IVA_TASA);
      const cliId    = (clientes[rng.int(0, clientes.length - 1)] as Contacto).id;

      const num   = await nextNumero(c, 'factura', 'FAC');
      const docId = await insertDocumento(c, {
        tipo_documento: 'factura', serie: 'FAC', numero: num,
        fecha_documento: fechaDoc, fecha_vencimiento: addDays(fechaDoc, 30),
        contacto_id: cliId, almacen_id: almGral.id,
        subtotal: sub, iva: ivaP, total: round2(sub + ivaP),
        estatus_documento: 'Emitido', concepto_id: CONCEPTO_VENTA,
      });
      const pid = await insertPartida(c, {
        documento_id: docId, numero: 1, producto_id: prod.id, cantidad: qty,
        precio_unitario: prod.precio, subtotal_partida: sub, total_partida: round2(sub + ivaP),
        iva_monto: ivaP, almacen_id: almGral.id,
      });
      await insertImpuesto(c, pid, sub, ivaP);
      await aplicarMovimiento(c, 'venta', ts(year, month, dia), docId,
        [{ producto_id: prod.id, almacen_id: almGral.id, cantidad: qty, signo: -1 }],
        `Venta relleno FAC-${num}`);
      ventasExtra++;
    }
  }

  if (comprasExtra + ventasExtra > 0) {
    console.log(`    ✓ Relleno: +${comprasExtra} compras / +${ventasExtra} ventas para alcanzar mínimo de movimientos`);
  }
  return { comprasExtra, ventasExtra };
}

// ─── Pagos a proveedores ─────────────────────────────────────

async function generarPagosProveedores(c: PoolClient, factIds: number[]) {
  let pagos = 0;
  for (let i = 0; i < factIds.length; i++) {
    if (i % 10 >= 7) continue; // 70% pagadas
    const { rows: [doc] } = await c.query<{ total: number; fecha_documento: string; contacto_principal_id: number }>(
      `SELECT total, fecha_documento::text, contacto_principal_id FROM documentos WHERE id=$1`, [factIds[i]],
    );
    if (!doc) continue;
    const esParcial = (i % 5 === 0);
    const monto     = esParcial ? round2(doc.total * 0.6) : round2(doc.total);
    const fechaPago = addDays(doc.fecha_documento, 15 + (i % 10));
    const num       = await nextNumero(c, 'pago_proveedor', 'PPR');
    const pagoDocId = await insertDocumento(c, {
      tipo_documento: 'pago_proveedor', serie: 'PPR', numero: num,
      fecha_documento: fechaPago, contacto_id: doc.contacto_principal_id,
      subtotal: monto, iva: 0, total: monto, estatus_documento: 'Pagado', concepto_id: CONCEPTO_COMPRA,
    });
    const opId = await insertFinanzasOp(c, {
      fecha: fechaPago, tipo_movimiento: 'Retiro', monto,
      contacto_id: doc.contacto_principal_id, documento_origen_id: pagoDocId,
      naturaleza_operacion: 'pago_proveedor', concepto_id: CONCEPTO_COMPRA,
    });
    await insertAplicacion(c, opId, factIds[i], monto);
    pagos++;
  }
  console.log(`    ✓ ${pagos} pagos a proveedor generados`);
}

// ─── Cobros de clientes ──────────────────────────────────────

async function generarPagosClientes(c: PoolClient, factIds: number[]) {
  let cobros = 0;
  for (let i = 0; i < factIds.length; i++) {
    if (i % 20 >= 13) continue; // 65% cobradas
    const { rows: [doc] } = await c.query<{ total: number; fecha_documento: string; contacto_principal_id: number }>(
      `SELECT total, fecha_documento::text, contacto_principal_id FROM documentos WHERE id=$1`, [factIds[i]],
    );
    if (!doc) continue;
    const esParcial = (i % 4 === 0);
    const pct       = 0.50 + (i % 4) * 0.10;
    const monto     = esParcial ? round2(doc.total * pct) : round2(doc.total);
    const fechaPago = addDays(doc.fecha_documento, 10 + (i % 15));
    const num       = await nextNumero(c, 'pago_cliente', 'PCL');
    const pagoDocId = await insertDocumento(c, {
      tipo_documento: 'pago_cliente', serie: 'PCL', numero: num,
      fecha_documento: fechaPago, contacto_id: doc.contacto_principal_id,
      subtotal: monto, iva: 0, total: monto, estatus_documento: 'Cobrado', concepto_id: CONCEPTO_VENTA,
    });
    const opId = await insertFinanzasOp(c, {
      fecha: fechaPago, tipo_movimiento: 'Deposito', monto,
      contacto_id: doc.contacto_principal_id, documento_origen_id: pagoDocId,
      naturaleza_operacion: 'cobro_cliente', concepto_id: CONCEPTO_VENTA,
    });
    await insertAplicacion(c, opId, factIds[i], monto);
    cobros++;
  }
  console.log(`    ✓ ${cobros} cobros de cliente generados`);
}

// ─── Ajustes de inventario ───────────────────────────────────

async function generarAjustes(
  c: PoolClient, rng: SeededRng, meses: [number, number][],
  almacenes: Almacen[], productos: Producto[],
) {
  const almGral = almacenes[0] as Almacen;
  const numAjustes = Math.max(8, Math.ceil(meses.length * 1.5));
  let creados = 0;

  for (let i = 0; i < numAjustes; i++) {
    const mes    = meses[rng.int(1, meses.length - 1)] as [number, number]; // evitar primer mes
    const [year, month] = mes;
    const dia    = rng.int(20, Math.min(diasEnMes(year, month) - 1, 28));
    const prod   = productos[rng.int(0, productos.length - 1)] as Producto;
    const esEntrada = rng.next() < 0.40;

    if (esEntrada) {
      const qty = rng.int(3, 15);
      await aplicarMovimiento(c, 'ajuste_entrada', ts(year, month, dia), null,
        [{ producto_id: prod.id, almacen_id: almGral.id, cantidad: qty, signo: 1, costo_unitario: prod.costo }],
        'Ajuste entrada inventario');
      creados++;
    } else {
      // Solo ajuste salida si hay stock suficiente
      const stock = getExist(prod.id, almGral.id);
      if (stock >= 5) {
        const qty = rng.int(1, Math.min(3, Math.floor(stock * 0.2)));
        await aplicarMovimiento(c, 'ajuste_salida', ts(year, month, dia), null,
          [{ producto_id: prod.id, almacen_id: almGral.id, cantidad: qty, signo: -1 }],
          'Ajuste salida / merma');
        creados++;
      }
    }
  }
  console.log(`    ✓ ${creados} ajustes de inventario generados`);
}

// ─── Traspasos entre almacenes ───────────────────────────────

async function generarTraspasos(
  c: PoolClient, rng: SeededRng, meses: [number, number][],
  almacenes: Almacen[], productos: Producto[],
) {
  const almGral   = almacenes[0] as Almacen;
  const almTienda = almacenes[1] as Almacen;
  const numTraspasos = Math.max(4, Math.ceil(meses.length * 0.7));
  let creados = 0;

  for (let i = 0; i < numTraspasos; i++) {
    const mes = meses[rng.int(1, meses.length - 1)] as [number, number];
    const [year, month] = mes;
    const dia  = rng.int(3, Math.min(diasEnMes(year, month) - 1, 20));
    // Producto con stock en GRAL
    const conStock = productos.filter(p => getExist(p.id, almGral.id) >= 10);
    if (conStock.length === 0) continue;
    const prod = conStock[rng.int(0, conStock.length - 1)] as Producto;
    const stockDisp = getExist(prod.id, almGral.id);
    const qty  = rng.int(5, Math.min(25, Math.floor(stockDisp * 0.4)));
    const fecha = ts(year, month, dia);

    await aplicarMovimiento(c, 'transferencia', fecha, null,
      [{ producto_id: prod.id, almacen_id: almGral.id, almacen_destino_id: almTienda.id,
         cantidad: qty, signo: -1, tipo_partida: 'salida_transferencia' }],
      `Traspaso GRAL→TIENDA`);
    await aplicarMovimiento(c, 'transferencia', fecha, null,
      [{ producto_id: prod.id, almacen_id: almTienda.id,
         cantidad: qty, signo: 1, tipo_partida: 'entrada_transferencia' }],
      `Traspaso GRAL→TIENDA (entrada)`);
    creados++;
  }
  console.log(`    ✓ ${creados} traspasos entre almacenes generados`);
}

// ─── Documentos pendientes (OC / Pedidos / Remisiones) ───────

async function generarDocumentosPendientes(
  c: PoolClient, rng: SeededRng, meses: [number, number][],
  almacenes: Almacen[], proveedores: Contacto[], clientes: Contacto[], productos: Producto[],
) {
  const N = 8;
  const almGral = almacenes[0] as Almacen;
  // Usar los 2 últimos meses del rango
  const mesesRecientes = meses.slice(Math.max(0, meses.length - 2));
  let ocCount = 0, pedCount = 0, remCount = 0;

  // Órdenes de compra pendientes
  for (let i = 0; i < N; i++) {
    const [year, month] = mesesRecientes[i % mesesRecientes.length] as [number, number];
    const dia      = rng.int(5, Math.min(diasEnMes(year, month) - 3, 25));
    const fechaDoc = d(year, month, dia);
    const provId   = proveedores[rng.int(0, proveedores.length - 1)].id;
    const sel      = selectProductos(rng, productos, 20, rng.int(2, 3));

    const items = sel.map(p => ({ prod: p, qty: rng.int(5, 20) }));
    const subtotal = round2(items.reduce((s, it) => s + it.qty * it.prod.costo, 0));
    const iva      = round2(subtotal * IVA_TASA);
    const total    = round2(subtotal + iva);

    const num   = await nextNumero(c, 'orden_compra', 'OC');
    const docId = await insertDocumento(c, {
      tipo_documento: 'orden_compra', serie: 'OC', numero: num, fecha_documento: fechaDoc,
      fecha_vencimiento: addDays(fechaDoc, 30), contacto_id: provId, almacen_id: almGral.id,
      subtotal, iva, total, estatus_documento: 'Emitido', concepto_id: CONCEPTO_COMPRA,
    });
    for (let ii = 0; ii < items.length; ii++) {
      const { prod, qty } = items[ii];
      const sub  = round2(qty * prod.costo);
      const ivaP = round2(sub * IVA_TASA);
      await insertPartida(c, {
        documento_id: docId, numero: ii + 1, producto_id: prod.id, cantidad: qty,
        precio_unitario: prod.costo, subtotal_partida: sub, total_partida: round2(sub + ivaP),
        iva_monto: ivaP, almacen_id: almGral.id,
      });
    }
    ocCount++;
  }

  // Pedidos de clientes pendientes
  for (let i = 0; i < N; i++) {
    const [year, month] = mesesRecientes[i % mesesRecientes.length] as [number, number];
    const dia      = rng.int(5, Math.min(diasEnMes(year, month) - 3, 25));
    const fechaDoc = d(year, month, dia);
    const cliId    = (clientes[rng.int(0, clientes.length - 1)] as Contacto).id;
    const sel      = selectProductos(rng, productos, cfg_altaRot_placeholder, rng.int(2, 3));

    const items = sel.map(p => ({ prod: p, qty: rng.int(1, 8) }));
    const subtotal = round2(items.reduce((s, it) => s + it.qty * it.prod.precio, 0));
    const iva      = round2(subtotal * IVA_TASA);
    const total    = round2(subtotal + iva);

    const num   = await nextNumero(c, 'pedido', 'PED');
    const docId = await insertDocumento(c, {
      tipo_documento: 'pedido', serie: 'PED', numero: num, fecha_documento: fechaDoc,
      fecha_vencimiento: addDays(fechaDoc, 15), contacto_id: cliId, almacen_id: almGral.id,
      subtotal, iva, total, estatus_documento: 'Emitido', concepto_id: CONCEPTO_VENTA,
    });
    for (let ii = 0; ii < items.length; ii++) {
      const { prod, qty } = items[ii];
      const sub  = round2(qty * prod.precio);
      const ivaP = round2(sub * IVA_TASA);
      await insertPartida(c, {
        documento_id: docId, numero: ii + 1, producto_id: prod.id, cantidad: qty,
        precio_unitario: prod.precio, subtotal_partida: sub, total_partida: round2(sub + ivaP),
        iva_monto: ivaP, almacen_id: almGral.id,
      });
    }
    pedCount++;
  }

  // Remisiones pendientes de facturar
  for (let i = 0; i < N; i++) {
    const [year, month] = mesesRecientes[i % mesesRecientes.length] as [number, number];
    const dia      = rng.int(10, Math.min(diasEnMes(year, month) - 1, 28));
    const fechaDoc = d(year, month, dia);
    const cliId    = (clientes[rng.int(0, clientes.length - 1)] as Contacto).id;
    const sel      = selectProductos(rng, productos, cfg_altaRot_placeholder, rng.int(2, 3));

    const items = sel.map(p => ({ prod: p, qty: rng.int(1, 6) }));
    const subtotal = round2(items.reduce((s, it) => s + it.qty * it.prod.precio, 0));
    const iva      = round2(subtotal * IVA_TASA);
    const total    = round2(subtotal + iva);

    const num   = await nextNumero(c, 'remision', 'REM');
    const docId = await insertDocumento(c, {
      tipo_documento: 'remision', serie: 'REM', numero: num, fecha_documento: fechaDoc,
      contacto_id: cliId, almacen_id: almGral.id,
      subtotal, iva, total, estatus_documento: 'Emitido', concepto_id: CONCEPTO_VENTA,
    });
    for (let ii = 0; ii < items.length; ii++) {
      const { prod, qty } = items[ii];
      const sub  = round2(qty * prod.precio);
      const ivaP = round2(sub * IVA_TASA);
      await insertPartida(c, {
        documento_id: docId, numero: ii + 1, producto_id: prod.id, cantidad: qty,
        precio_unitario: prod.precio, subtotal_partida: sub, total_partida: round2(sub + ivaP),
        iva_monto: ivaP, almacen_id: almGral.id,
      });
    }
    remCount++;
  }

  console.log(`    ✓ ${ocCount} OC / ${pedCount} pedidos / ${remCount} remisiones pendientes`);
}

// cfg_altaRot_placeholder será reemplazado con un closure en main()
// Necesito pasar cfg a la función — ver refactor en main()
let cfg_altaRot_placeholder = 12; // valor temporal

// ─── Actualizar saldos ───────────────────────────────────────

async function actualizarSaldos(c: PoolClient) {
  await c.query(`
    UPDATE documentos d
       SET saldo = d.total - COALESCE((
             SELECT SUM(a.monto) FROM aplicaciones_saldo a
              WHERE a.documento_destino_id = d.id AND a.empresa_id = d.empresa_id
           ), 0)
     WHERE d.empresa_id = $1
       AND d.tipo_documento IN ('factura','factura_compra')
  `, [EMPRESA_ID]);
  console.log('    ✓ Saldos recalculados');
}

// ─── Validaciones ────────────────────────────────────────────

async function validarConsistencia(c: PoolClient, productos: Producto[], cfg: Config) {
  const advertencias: string[] = [];

  // Productos con menos movimientos que el mínimo
  const prodsBajoMin: string[] = [];
  for (const prod of productos) {
    const mov = memMovs.get(prod.id) ?? 0;
    if (mov < cfg.minMovimientosPorProducto) {
      prodsBajoMin.push(`${prod.clave}(${mov})`);
    }
  }
  if (prodsBajoMin.length > 0) {
    advertencias.push(`${prodsBajoMin.length} productos con < ${cfg.minMovimientosPorProducto} movimientos: ${prodsBajoMin.slice(0, 5).join(', ')}${prodsBajoMin.length > 5 ? '...' : ''}`);
  }

  // Existencias negativas en BD
  const { rows: negRows } = await c.query(
    `SELECT p.clave, a.clave AS almacen, e.existencia
       FROM inventario.existencias e
       JOIN productos p ON p.id = e.producto_id
       JOIN inventario.almacenes a ON a.id = e.almacen_id
      WHERE e.empresa_id = $1 AND e.existencia < 0`,
    [EMPRESA_ID],
  );
  if (negRows.length > 0) {
    advertencias.push(`${negRows.length} existencias negativas: ${negRows.map((r: { clave: string; almacen: string }) => `${r.clave}/${r.almacen}`).join(', ')}`);
  }

  // Documentos sin partidas
  const { rows: sinPartidas } = await c.query(
    `SELECT tipo_documento, COUNT(*) AS n FROM documentos d
      WHERE d.empresa_id = $1
        AND NOT EXISTS (SELECT 1 FROM documentos_partidas dp WHERE dp.documento_id = d.id)
        AND tipo_documento IN ('factura','factura_compra','orden_compra','pedido','remision')
      GROUP BY tipo_documento`,
    [EMPRESA_ID],
  );
  if (sinPartidas.length > 0) {
    advertencias.push(`Documentos sin partidas: ${sinPartidas.map((r: { tipo_documento: string; n: string }) => `${r.tipo_documento}(${r.n})`).join(', ')}`);
  }

  // Saldos negativos inesperados en facturas
  const { rows: saldosNeg } = await c.query(
    `SELECT COUNT(*) AS n FROM documentos WHERE empresa_id=$1 AND saldo < 0
      AND tipo_documento IN ('factura','factura_compra')`,
    [EMPRESA_ID],
  );
  if (Number(saldosNeg[0].n) > 0) {
    advertencias.push(`${saldosNeg[0].n} facturas con saldo negativo inesperado`);
  }

  // Pagos sin aplicación de saldo
  const { rows: pagosSinApl } = await c.query(
    `SELECT COUNT(*) AS n FROM documentos d
      WHERE d.empresa_id=$1
        AND d.tipo_documento IN ('pago_cliente','pago_proveedor')
        AND NOT EXISTS (
          SELECT 1 FROM finanzas_operaciones fo
           WHERE fo.documento_origen_id = d.id AND fo.empresa_id = d.empresa_id
        )`,
    [EMPRESA_ID],
  );
  if (Number(pagosSinApl[0].n) > 0) {
    advertencias.push(`${pagosSinApl[0].n} pagos sin operación financiera`);
  }

  if (advertencias.length === 0) {
    console.log('\n  ✓ Validaciones: sin advertencias');
  } else {
    console.log('\n  ⚠  ADVERTENCIAS DE VALIDACIÓN:');
    for (const adv of advertencias) console.log(`     ! ${adv}`);
  }
}

// ─── Resumen final ───────────────────────────────────────────

async function imprimirResumen(c: PoolClient, cfg: Config, meses: [number, number][], productos: Producto[]) {
  const { rows: [r] } = await c.query(`
    SELECT
      (SELECT count(*) FROM inventario.almacenes WHERE empresa_id=$1)                         AS almacenes,
      (SELECT count(*) FROM unidades WHERE empresa_id=$1)                                      AS unidades,
      (SELECT count(*) FROM contactos WHERE empresa_id=$1 AND tipo_contacto='Proveedor')       AS proveedores,
      (SELECT count(*) FROM contactos WHERE empresa_id=$1 AND tipo_contacto='Cliente')         AS clientes,
      (SELECT count(*) FROM productos WHERE empresa_id=$1)                                     AS productos,
      (SELECT count(*) FROM documentos WHERE empresa_id=$1 AND tipo_documento='factura_compra')AS facturas_compra,
      (SELECT count(*) FROM documentos WHERE empresa_id=$1 AND tipo_documento='factura')        AS facturas_venta,
      (SELECT count(*) FROM documentos WHERE empresa_id=$1 AND tipo_documento='orden_compra')  AS oc_pendientes,
      (SELECT count(*) FROM documentos WHERE empresa_id=$1 AND tipo_documento='pedido')        AS pedidos_pend,
      (SELECT count(*) FROM documentos WHERE empresa_id=$1 AND tipo_documento='remision')      AS remisiones_pend,
      (SELECT count(*) FROM documentos WHERE empresa_id=$1 AND tipo_documento='pago_proveedor')AS pagos_prov,
      (SELECT count(*) FROM documentos WHERE empresa_id=$1 AND tipo_documento='pago_cliente')  AS cobros_cli,
      (SELECT count(*) FROM aplicaciones_saldo WHERE empresa_id=$1)                            AS aplicaciones,
      (SELECT count(*) FROM finanzas_operaciones WHERE empresa_id=$1)                          AS operaciones_fin,
      (SELECT count(*) FROM inventario.movimientos WHERE empresa_id=$1)                        AS movimientos,
      (SELECT count(*) FROM inventario.movimientos_partidas WHERE empresa_id=$1)               AS partidas_mov,
      (SELECT count(*) FROM inventario.existencias WHERE empresa_id=$1)                        AS existencias,
      (SELECT count(*) FROM documentos WHERE empresa_id=$1 AND tipo_documento='factura' AND saldo>0)          AS cxc_pendiente,
      (SELECT count(*) FROM documentos WHERE empresa_id=$1 AND tipo_documento='factura_compra' AND saldo>0)   AS cxp_pendiente,
      (SELECT count(*) FROM documentos WHERE empresa_id=$1 AND tipo_documento='factura' AND saldo>0 AND saldo<total) AS cxc_parcial,
      (SELECT COALESCE(SUM(total),0) FROM documentos WHERE empresa_id=$1 AND tipo_documento='factura')        AS total_ventas,
      (SELECT COALESCE(SUM(total),0) FROM documentos WHERE empresa_id=$1 AND tipo_documento='factura_compra') AS total_compras
  `, [EMPRESA_ID]);

  // Distribución de movimientos por producto
  let mov0=0, mov1=0, mov23=0, mov4p=0;
  const topProds: [string, number][] = [];
  for (const prod of productos) {
    const n = memMovs.get(prod.id) ?? 0;
    if (n === 0) mov0++;
    else if (n === 1) mov1++;
    else if (n <= 3) mov23++;
    else mov4p++;
    topProds.push([prod.clave, n]);
  }
  topProds.sort((a, b) => b[1] - a[1]);

  // Productos bajo mínimo (en memoria)
  const { rows: bajoMin } = await c.query(`
    SELECT count(*) AS n FROM (
      SELECT p.id FROM productos p
        JOIN inventario.existencias e ON e.producto_id = p.id AND e.empresa_id = p.empresa_id
       WHERE p.empresa_id=$1
       GROUP BY p.id, p.minimo_inventario
      HAVING COALESCE(SUM(e.existencia),0) < p.minimo_inventario
    ) t`, [EMPRESA_ID]);

  const sep = '═'.repeat(60);
  const lin = '─'.repeat(60);
  console.log(`\n${sep}`);
  console.log(' RESUMEN DE DATOS DEMO — EMPRESA ID 8');
  console.log(sep);
  console.log(` Empresa ID:                8 (EKU9003173C9)`);
  console.log(` Periodo:                   ${cfg.desde} → ${cfg.hasta}`);
  console.log(` Meses:                     ${meses.length}`);
  console.log(` Seed:                      ${cfg.seed}`);
  console.log(` Limpieza ejecutada:        ${cfg.limpiar ? 'Sí' : 'No'}`);
  console.log(lin);
  console.log(` Almacenes:                 ${r.almacenes}`);
  console.log(` Unidades de medida:        ${r.unidades}`);
  console.log(` Proveedores:               ${r.proveedores}`);
  console.log(` Clientes:                  ${r.clientes}`);
  console.log(` Productos:                 ${r.productos}`);
  console.log(lin);
  console.log(` Facturas de compra:        ${r.facturas_compra}`);
  console.log(` Facturas de venta:         ${r.facturas_venta}`);
  console.log(` OC pendientes de recibir:  ${r.oc_pendientes}`);
  console.log(` Pedidos pendientes:        ${r.pedidos_pend}`);
  console.log(` Remisiones pendientes:     ${r.remisiones_pend}`);
  console.log(` Pagos a proveedor:         ${r.pagos_prov}`);
  console.log(` Cobros de cliente:         ${r.cobros_cli}`);
  console.log(` Aplicaciones de saldo:     ${r.aplicaciones}`);
  console.log(` Operaciones financieras:   ${r.operaciones_fin}`);
  console.log(lin);
  console.log(` Movimientos inventario:    ${r.movimientos}`);
  console.log(` Partidas de movimiento:    ${r.partidas_mov}`);
  console.log(` Existencias (prod/alm):    ${r.existencias}`);
  console.log(lin);
  console.log(` CxC pendiente de cobro:    ${r.cxc_pendiente} facturas`);
  console.log(` CxC cobro parcial:         ${r.cxc_parcial} facturas`);
  console.log(` CxP pendiente de pago:     ${r.cxp_pendiente} facturas`);
  console.log(` Productos bajo mínimo:     ${bajoMin[0].n}`);
  console.log(` Total ventas período:      $${Number(r.total_ventas).toLocaleString('es-MX',{minimumFractionDigits:2})}`);
  console.log(` Total compras período:     $${Number(r.total_compras).toLocaleString('es-MX',{minimumFractionDigits:2})}`);
  console.log(lin);
  console.log(` Movimientos por producto:`);
  console.log(`   0 mov:      ${mov0} productos`);
  console.log(`   1 mov:      ${mov1} productos`);
  console.log(`   2-3 mov:    ${mov23} productos`);
  console.log(`   4+ mov:     ${mov4p} productos  ← objetivo >= ${cfg.minMovimientosPorProducto}`);
  console.log(` Top 10 productos (más movimientos):`);
  for (const [clave, n] of topProds.slice(0, 10)) {
    console.log(`   ${clave.padEnd(8)} ${n} movimientos`);
  }
  console.log(sep);
  console.log('\n REPORTES ALIMENTADOS:');
  console.log('  ✓ Ventas por Cliente / por Producto / por Período');
  console.log('  ✓ Estado de Cuenta de Cliente (CxC) — saldos y parciales');
  console.log('  ✓ Historial de Precios de Venta');
  console.log('  ✓ Compras por Proveedor / por Producto / por Período');
  console.log('  ✓ Estado de Cuenta de Proveedor (CxP)');
  console.log('  ✓ Historial de Precios de Compra');
  console.log('  ✓ Kardex / Movimientos por Producto (entradas+salidas+ajustes+traspasos)');
  console.log('  ✓ Existencias Actuales por Almacén');
  console.log('  ✓ Productos Bajo Mínimo');
  console.log('  ✓ Inventario Valorizado');
  console.log('  ✓ Órdenes de Compra Pendientes de Recibir');
  console.log('  ✓ Pedidos Pendientes de Facturar');
  console.log('  ✓ Remisiones Pendientes de Facturar');
  console.log(sep);
  const cmd = `npx ts-node --compiler-options '{"target":"ES2020","module":"commonjs","esModuleInterop":true,"strict":true,"skipLibCheck":true}' scripts/seed-demo-empresa-8.ts --desde=${cfg.desde} --hasta=${cfg.hasta} --ventas=${cfg.ventas} --compras=${cfg.compras} --minMovimientosPorProducto=${cfg.minMovimientosPorProducto} --productosAltaRotacion=${cfg.productosAltaRotacion} --seed=${cfg.seed}`;
  console.log('\n Comando para repetir esta ejecución:');
  console.log(` cd backend && ${cmd}`);
  console.log(sep);
}

// ─── MAIN ────────────────────────────────────────────────────

async function main() {
  const cfg   = parseCLI();
  const meses = generarMeses(cfg.desde, cfg.hasta);
  validarConfig(cfg, meses);

  // Exponer cfg.productosAltaRotacion a generarDocumentosPendientes
  cfg_altaRot_placeholder = cfg.productosAltaRotacion;

  const rng = new SeededRng(cfg.seed);

  console.log('\n🚀  SEED DEMO — empresa_id = 8');
  console.log(`    Periodo: ${cfg.desde} → ${cfg.hasta} (${meses.length} meses)`);
  console.log(`    Compras: ${cfg.compras} | Ventas: ${cfg.ventas} | Min movs/prod: ${cfg.minMovimientosPorProducto}`);
  console.log(`    Alta rotación: top ${cfg.productosAltaRotacion} productos | Seed: ${cfg.seed}`);
  console.log(`    Limpiar: ${cfg.limpiar}`);
  console.log('─'.repeat(60));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (cfg.limpiar) {
      await cleanup(client);
    } else {
      const { rows } = await client.query(
        `SELECT count(*) AS n FROM productos WHERE empresa_id=$1`, [EMPRESA_ID],
      );
      if (Number(rows[0].n) > 0) {
        throw new Error(
          `Ya existen ${rows[0].n} productos en empresa_id=8. ` +
          `Ejecuta con --limpiar=true para regenerar desde cero.`,
        );
      }
    }

    console.log('\n📦  Creando catálogos...');
    const almacenes   = await crearAlmacenes(client);
    const unidades    = await crearUnidades(client);
    const proveedores = await crearProveedores(client);
    const clientes    = await crearClientes(client);
    const productos   = await crearProductos(client, unidades, proveedores);
    await crearListasPrecios(client, productos);
    await setupSeries(client);

    console.log('\n🛒  Generando compras...');
    const factComprasIds = await generarCompras(client, cfg, rng, meses, almacenes, proveedores, productos);

    console.log('\n💰  Generando ventas (con verificación de stock)...');
    const factVentasIds = await generarVentas(client, cfg, rng, meses, almacenes, clientes, productos);

    console.log('\n🔄  Garantizando movimientos mínimos por producto...');
    await generarMovimientosGarantizados(client, cfg, rng, meses, almacenes, proveedores, clientes, productos);

    console.log('\n💳  Generando pagos...');
    await generarPagosProveedores(client, factComprasIds);
    await generarPagosClientes(client, factVentasIds);

    console.log('\n⚖️   Generando ajustes y traspasos...');
    await generarAjustes(client, rng, meses, almacenes, productos);
    await generarTraspasos(client, rng, meses, almacenes, productos);

    console.log('\n📋  Generando documentos pendientes (OC / Pedidos / Remisiones)...');
    await generarDocumentosPendientes(client, rng, meses, almacenes, proveedores, clientes, productos);

    console.log('\n🔄  Recalculando saldos...');
    await actualizarSaldos(client);

    await client.query('COMMIT');
    console.log('\n✅  Transacción confirmada');

    await validarConsistencia(client, productos, cfg);
    await imprimirResumen(client, cfg, meses, productos);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  Error — transacción revertida:');
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
