/**
 * Datos ficticios del prototipo de Nota de Crédito.
 * No corresponden a registros reales ni se persisten.
 */

export type Escena = 'nueva' | 'editar' | 'desde-factura';
export type Motivo = 'devolucion' | 'bonificacion' | 'otro';

export type PartidaMock = {
  id: string;
  factura: string;
  fecha: string;
  clave: string;
  descripcion: string;
  facturado: number;
  devuelto: number;
  precio: number;
  base: number;
  maximo: number;
};

export const CLIENTE = {
  id: 'demo',
  nombre: 'COMERCIALIZADORA DEMO SA DE CV',
};

export const PARTIDAS: PartidaMock[] = [
  {
    id: 'a7-1',
    factura: 'A-007',
    fecha: '2026-08-12',
    clave: 'TOR-38-ZN',
    descripcion: 'Tornillo hexagonal 3/8" zincado',
    facturado: 120,
    devuelto: 0,
    precio: 4.5,
    base: 540,
    maximo: 540,
  },
  {
    id: 'a7-2',
    factura: 'A-007',
    fecha: '2026-08-12',
    clave: 'TUE-38',
    descripcion: 'Tuerca hexagonal 3/8"',
    facturado: 80,
    devuelto: 20,
    precio: 1.85,
    base: 148,
    maximo: 111,
  },
  {
    id: 'a7-3',
    factura: 'A-007',
    fecha: '2026-08-12',
    clave: 'ARA-38-304',
    descripcion: 'Arandela plana 3/8" acero inoxidable grado 304, bolsa 100 pzas',
    facturado: 200.5,
    devuelto: 0,
    precio: 0.92,
    base: 184.46,
    maximo: 184.46,
  },
  {
    id: 'a11-1',
    factura: 'A-011',
    fecha: '2026-08-28',
    clave: 'PTR-2X2-14',
    descripcion: 'Perfil PTR 2" × 2" calibre 14, tramo de 6.00 m',
    facturado: 18,
    devuelto: 6,
    precio: 486,
    base: 8748,
    maximo: 5832,
  },
  {
    id: 'a11-2',
    factura: 'A-011',
    fecha: '2026-08-28',
    clave: 'SOL-6013-20',
    descripcion: 'Soldadura electrodo 6013 de 3/32", caja 20 kg',
    facturado: 4,
    devuelto: 0,
    precio: 890,
    base: 3560,
    maximo: 3560,
  },
  {
    id: 'a11-3',
    factura: 'A-011',
    fecha: '2026-08-28',
    clave: 'DIS-412',
    descripcion: 'Disco de corte para metal 4-1/2"',
    facturado: 50,
    devuelto: 12,
    precio: 28.4,
    base: 1420,
    maximo: 1079.2,
  },
  {
    id: 'a15-1',
    factura: 'A-015',
    fecha: '2026-09-10',
    clave: 'PIN-ESM-19',
    descripcion: 'Pintura esmalte alquidálico blanco brillante, cubeta 19 L',
    facturado: 6,
    devuelto: 0,
    precio: 1240,
    base: 7440,
    maximo: 7440,
  },
  {
    id: 'a15-2',
    factura: 'A-015',
    fecha: '2026-09-10',
    clave: 'THI-19',
    descripcion: 'Thinner estándar, garrafa 19 L',
    facturado: 3.5,
    devuelto: 1,
    precio: 410,
    base: 1435,
    maximo: 1025,
  },
  {
    id: 'a15-3',
    factura: 'A-015',
    fecha: '2026-09-10',
    clave: 'BRO-4-CN',
    descripcion: 'Brocha profesional 4" de cerda natural',
    facturado: 24,
    devuelto: 0,
    precio: 67.5,
    base: 1620,
    maximo: 1620,
  },
  {
    id: 'a15-4',
    factura: 'A-015',
    fecha: '2026-09-10',
    clave: 'LIJ-220-50',
    descripcion: 'Lija de agua grano 220, paquete con 50 hojas',
    facturado: 15,
    devuelto: 5,
    precio: 54,
    base: 810,
    maximo: 540,
  },
];

const CANTIDADES_BORRADOR: Record<string, string> = {
  'a7-1': '24',
  'a7-3': '15.5',
  'a11-1': '4',
  'a11-3': '10',
  'a15-1': '2',
  'a15-4': '3',
};

const CANTIDADES_DESDE_FACTURA: Record<string, string> = {
  'a7-1': '24',
  'a7-3': '15.5',
};

const MONTOS_BORRADOR: Record<string, string> = {
  'a7-1': '150.00',
  'a11-1': '1,200.00',
  'a11-3': '200.00',
  'a15-1': '500.00',
  'a15-4': '180.00',
};

const MONTOS_DESDE_FACTURA: Record<string, string> = {
  'a7-1': '150.00',
  'a7-3': '40.00',
};

function completar(semilla: Record<string, string>): Record<string, string> {
  return Object.fromEntries(PARTIDAS.map((partida) => [partida.id, semilla[partida.id] ?? '']));
}

function idsConValor(semilla: Record<string, string>): string[] {
  return Object.entries(semilla)
    .filter(([, value]) => value.trim() !== '')
    .map(([id]) => id);
}

/** Partidas que la captura muestra al abrir cada escena. El resto se incorpora desde el selector. */
export function partidasIniciales(escena: Escena): string[] {
  if (escena === 'desde-factura') {
    return PARTIDAS.filter((partida) => partida.factura === 'A-007').map((partida) => partida.id);
  }
  const elegidas = new Set([
    ...idsConValor(CANTIDADES_BORRADOR),
    ...idsConValor(MONTOS_BORRADOR),
  ]);
  return PARTIDAS.filter((partida) => elegidas.has(partida.id)).map((partida) => partida.id);
}

export function seedCantidades(escena: Escena): Record<string, string> {
  return completar(escena === 'desde-factura' ? CANTIDADES_DESDE_FACTURA : CANTIDADES_BORRADOR);
}

export function seedMontos(escena: Escena): Record<string, string> {
  return completar(escena === 'desde-factura' ? MONTOS_DESDE_FACTURA : MONTOS_BORRADOR);
}

/** Catálogo ficticio. La cuenta contable vive en la configuración del concepto, no en la captura. */
export const CONCEPTOS_OTRO = [
  { id: 'ajuste-precio', descripcion: 'Ajuste por diferencia de precio' },
  { id: 'descuento-comercial', descripcion: 'Descuento comercial no aplicado en factura' },
  { id: 'bonificacion-volumen', descripcion: 'Bonificación por volumen' },
  { id: 'devolucion-anticipo', descripcion: 'Devolución de anticipo' },
  { id: 'servicio-no-prestado', descripcion: 'Servicio no prestado' },
] as const;

export function seedOtro(escena: Escena): { conceptoId: string; importe: string } {
  if (escena === 'editar') {
    return { conceptoId: 'ajuste-precio', importe: '1,800.00' };
  }
  return { conceptoId: '', importe: '' };
}

export function seedReferencia(escena: Escena): string {
  return escena === 'editar' ? 'Acuerdo con el cliente' : '';
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function disponibleDe(partida: PartidaMock): number {
  return round2(partida.facturado - partida.devuelto);
}

export function parseNumero(raw: string): number | null {
  const compacto = raw.trim().replace(/,/g, '');
  if (compacto === '' || compacto === '.') return 0;
  if (!/^\d*\.?\d*$/.test(compacto)) return null;
  const value = Number(compacto);
  return Number.isFinite(value) ? value : null;
}

export function formatCantidad(value: number): string {
  return value.toLocaleString('es-MX', { maximumFractionDigits: 2 });
}

export function formatMoney(value: number): string {
  const rounded = round2(value);
  const abs = Math.abs(rounded).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return rounded < 0 ? `-$${abs}` : `$${abs}`;
}

export function formatMoneyInput(value: number): string {
  return round2(value).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatFecha(iso: string): string {
  const partes = iso.split('-');
  const year = Number(partes[0]);
  const month = Number(partes[1]);
  const day = Number(partes[2]);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
