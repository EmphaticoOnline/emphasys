import type { FinanzasOperacion } from '../../types/finanzas';
import { referenciaCapturada } from './origenMovimiento';
import { etiquetaContraparteTransferencia } from './transferenciaLogica';
import { resolverFolioVisual } from '../../utils/documentos.utils';

export type CampoTexto = 'contacto' | 'concepto' | 'referencia' | 'documento' | 'observaciones' | 'tipo' | 'estado';
export type CampoNumerico = 'monto' | 'entrada' | 'salida';
export type OperadorNumero = 'eq' | 'gte' | 'lte';
export type OperadorFecha = 'eq' | 'gte' | 'lte' | 'between';

export type FiltroTexto = { tipo: 'texto'; campo: CampoTexto; valor: string };
export type FiltroNumerico = { tipo: 'numerico'; campo: CampoNumerico; operador: OperadorNumero; valor: number };
export type FiltroFecha = { tipo: 'fecha'; campo: 'fecha'; operador: OperadorFecha; valor: string; hasta?: string; nombre?: string };
export type FiltroMovimiento = FiltroTexto | FiltroNumerico | FiltroFecha;
export type SugerenciaMovimiento = FiltroMovimiento;

export const ETIQUETA_TEXTO: Record<CampoTexto, string> = {
  contacto: 'Contacto',
  concepto: 'Concepto',
  referencia: 'Referencia',
  documento: 'Documento',
  observaciones: 'Observaciones',
  tipo: 'Tipo',
  estado: 'Estado',
};

export const ETIQUETA_NUMERO: Record<CampoNumerico, string> = {
  monto: 'Monto',
  entrada: 'Depósito',
  salida: 'Retiro',
};

export const ETIQUETA_OPERADOR: Record<OperadorNumero, string> = {
  eq: 'igual a',
  gte: 'mayor o igual a',
  lte: 'menor o igual a',
};

const CAMPOS_TEXTO: CampoTexto[] = ['contacto', 'concepto', 'referencia', 'documento', 'observaciones', 'tipo', 'estado'];
const CAMPOS_NUMERO: CampoNumerico[] = ['monto', 'entrada', 'salida'];
const OPERADORES: OperadorNumero[] = ['eq', 'gte', 'lte'];
const TOPE_TEXTO = 20;

export function normalizarBusqueda(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function parseCantidad(raw: string): number | null {
  let value = raw.trim().replace(/^(>=|<=|>|<)/, '').trim();
  const negative = value.startsWith('-');
  value = value.replace(/^-/, '').replace(/^\$/, '').trim();
  if (value.includes(',') && value.includes('.')) value = value.replace(/,/g, '');
  else if (value.includes(',')) {
    value = /^\d{1,3}(,\d{3})+$/.test(value) ? value.replace(/,/g, '') : value.replace(/,/g, '.');
  }
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

function isoFecha(year: number, month: number, day: number): string | null {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function claveDia(date: Date): string {
  return isoFecha(date.getFullYear(), date.getMonth() + 1, date.getDate()) ?? '';
}

function ultimoDiaMes(year: number, month: number): string {
  return isoFecha(year, month, new Date(year, month, 0).getDate()) ?? '';
}

export type LecturaFecha =
  | { kind: 'dia'; valor: string }
  | { kind: 'rango'; valor: string; hasta: string; nombre: string };

export function interpretarFecha(raw: string, hoy = new Date()): LecturaFecha | null {
  const text = normalizarBusqueda(raw).replace(/\s+/g, ' ');
  if (!text) return null;
  if (text === 'hoy') return { kind: 'dia', valor: claveDia(hoy) };
  if (text === 'ayer') {
    const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
    return { kind: 'dia', valor: claveDia(ayer) };
  }
  if (text === 'este mes') {
    const year = hoy.getFullYear();
    const month = hoy.getMonth() + 1;
    return { kind: 'rango', valor: isoFecha(year, month, 1) ?? '', hasta: ultimoDiaMes(year, month), nombre: 'Este mes' };
  }
  if (text === 'mes pasado') {
    const cursor = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    return { kind: 'rango', valor: isoFecha(year, month, 1) ?? '', hasta: ultimoDiaMes(year, month), nombre: 'Mes pasado' };
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const valor = isoFecha(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    return valor ? { kind: 'dia', valor } : null;
  }
  const completa = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (completa) {
    const valor = isoFecha(Number(completa[3]), Number(completa[2]), Number(completa[1]));
    return valor ? { kind: 'dia', valor } : null;
  }
  const diaMes = text.match(/^(\d{1,2})[/-](\d{1,2})[/-]?$/);
  if (diaMes) {
    const valor = isoFecha(hoy.getFullYear(), Number(diaMes[2]), Number(diaMes[1]));
    return valor ? { kind: 'dia', valor } : null;
  }
  const soloDia = text.match(/^(\d{1,2})[/-]$/);
  if (soloDia) {
    const valor = isoFecha(hoy.getFullYear(), hoy.getMonth() + 1, Number(soloDia[1]));
    return valor ? { kind: 'dia', valor } : null;
  }
  return null;
}

export function parseFechaBusqueda(raw: string, hoy = new Date()): string | null {
  const lectura = interpretarFecha(raw, hoy);
  return lectura?.kind === 'dia' ? lectura.valor : null;
}

export function formatearFechaBusqueda(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function formatearCantidad(value: number): string {
  return Math.abs(value).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function centavos(value: number): number {
  return Math.round(value * 100);
}

export function compararCentavos(actual: number, operador: OperadorNumero, esperado: number): boolean {
  const left = centavos(actual);
  const right = centavos(esperado);
  if (operador === 'gte') return left >= right;
  if (operador === 'lte') return left <= right;
  return left === right;
}

function fechaClave(value: string | null | undefined): string {
  const match = String(value ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? '';
}

function etiquetaTipo(tipo: string | null | undefined): string {
  if (tipo === 'Deposito') return 'Depósito';
  if (tipo === 'Retiro') return 'Retiro';
  return String(tipo ?? '');
}

function etiquetaEstado(estado: string | null | undefined): string {
  if (estado === 'cotejado') return 'Encontrado en banco';
  if (estado === 'conciliado') return 'Conciliado';
  return 'Pendiente';
}

function folio(op: FinanzasOperacion): string {
  if (!op.documento_origen_id || !op.documento_origen_tipo_documento) return '';
  return resolverFolioVisual(
    {
      serie: op.documento_origen_serie ?? null,
      numero: op.documento_origen_numero ?? null,
      serie_externa: op.documento_origen_serie_externa ?? null,
      numero_externo: op.documento_origen_numero_externo ?? null,
    },
    op.documento_origen_tipo_documento,
  );
}

function montoFirmado(op: FinanzasOperacion): number {
  const abs = Math.abs(Number(op.monto) || 0);
  return op.tipo_movimiento === 'Retiro' ? -abs : abs;
}

export function valoresCampo(op: FinanzasOperacion, campo: CampoTexto): string[] {
  if (campo === 'contacto') {
    return [
      op.contacto_nombre || '',
      op.es_transferencia || op.transferencia_id ? etiquetaContraparteTransferencia(op) : '',
    ];
  }
  if (campo === 'concepto') return [op.concepto_nombre || '', op.es_transferencia ? 'Transferencia' : ''];
  if (campo === 'referencia') return [referenciaCapturada(op)];
  if (campo === 'documento') return [folio(op)];
  if (campo === 'observaciones') return [op.observaciones || ''];
  if (campo === 'tipo') return [etiquetaTipo(op.tipo_movimiento)];
  return [etiquetaEstado(op.estado_conciliacion)];
}

function textosLibres(op: FinanzasOperacion): string[] {
  const fecha = fechaClave(op.fecha);
  return [
    ...CAMPOS_TEXTO.flatMap((campo) => valoresCampo(op, campo)),
    fecha,
    fecha ? formatearFechaBusqueda(fecha) : '',
  ];
}

function cumpleFiltro(op: FinanzasOperacion, filtro: FiltroMovimiento): boolean {
  if (filtro.tipo === 'texto') {
    const esperado = normalizarBusqueda(filtro.valor);
    return valoresCampo(op, filtro.campo).some((valor) => normalizarBusqueda(valor).includes(esperado));
  }
  if (filtro.tipo === 'fecha') {
    const actual = fechaClave(op.fecha);
    if (!actual) return false;
    if (filtro.operador === 'between') return actual >= filtro.valor && actual <= (filtro.hasta ?? filtro.valor);
    if (filtro.operador === 'gte') return actual >= filtro.valor;
    if (filtro.operador === 'lte') return actual <= filtro.valor;
    return actual === filtro.valor;
  }
  const firmado = montoFirmado(op);
  if (filtro.campo === 'entrada') {
    if (firmado <= 0) return false;
    return compararCentavos(firmado, filtro.operador, Math.abs(filtro.valor));
  }
  if (filtro.campo === 'salida') {
    if (firmado >= 0) return false;
    return compararCentavos(Math.abs(firmado), filtro.operador, Math.abs(filtro.valor));
  }
  return compararCentavos(firmado, filtro.operador, filtro.valor);
}

export function filtrarMovimientos(
  operaciones: FinanzasOperacion[],
  filtros: FiltroMovimiento[],
  query: string,
): FinanzasOperacion[] {
  let result = operaciones;
  for (const filtro of filtros) result = result.filter((op) => cumpleFiltro(op, filtro));
  const words = normalizarBusqueda(query).split(/\s+/).filter(Boolean);
  for (const word of words) {
    result = result.filter((op) => textosLibres(op).some((texto) => normalizarBusqueda(texto).includes(word)));
  }
  return result;
}

export function sugerirMovimientos(operaciones: FinanzasOperacion[], query: string, hoy = new Date()): SugerenciaMovimiento[] {
  const q = normalizarBusqueda(query);
  if (!q) return [];
  const vistos = new Set<string>();
  const textos: FiltroTexto[] = [];
  for (const op of operaciones) {
    for (const campo of CAMPOS_TEXTO) {
      for (const valor of valoresCampo(op, campo)) {
        const limpio = valor.trim();
        if (!limpio || limpio === '—') continue;
        const clave = `${campo}:${normalizarBusqueda(limpio)}`;
        if (vistos.has(clave) || !normalizarBusqueda(limpio).includes(q)) continue;
        vistos.add(clave);
        textos.push({ tipo: 'texto', campo, valor: limpio });
      }
    }
  }
  const sugerencias: SugerenciaMovimiento[] = textos.slice(0, TOPE_TEXTO);
  const cantidad = parseCantidad(query.trim());
  if (cantidad !== null) {
    const absoluto = Math.abs(cantidad);
    for (const campo of CAMPOS_NUMERO) {
      for (const operador of OPERADORES) {
        sugerencias.push({
          tipo: 'numerico',
          campo,
          operador,
          valor: campo === 'monto' ? cantidad : absoluto,
        });
      }
    }
  }
  const fecha = interpretarFecha(query.trim(), hoy);
  if (fecha?.kind === 'dia') {
    for (const operador of ['eq', 'lte', 'gte'] as const) {
      sugerencias.push({ tipo: 'fecha', campo: 'fecha', operador, valor: fecha.valor });
    }
  } else if (fecha?.kind === 'rango') {
    sugerencias.push({ tipo: 'fecha', campo: 'fecha', operador: 'between', valor: fecha.valor, hasta: fecha.hasta, nombre: fecha.nombre });
  }
  return sugerencias;
}

export function etiquetaSugerencia(sugerencia: SugerenciaMovimiento): { etiqueta: string; detalle: string } {
  if (sugerencia.tipo === 'texto') return { etiqueta: ETIQUETA_TEXTO[sugerencia.campo], detalle: sugerencia.valor };
  if (sugerencia.tipo === 'fecha') {
    if (sugerencia.operador === 'between') {
      const desde = formatearFechaBusqueda(sugerencia.valor);
      const hasta = formatearFechaBusqueda(sugerencia.hasta ?? sugerencia.valor);
      return { etiqueta: 'Fecha', detalle: `${sugerencia.nombre ?? 'Periodo'} · ${desde} – ${hasta}` };
    }
    const fecha = formatearFechaBusqueda(sugerencia.valor);
    const detalle = sugerencia.operador === 'eq'
      ? `En ${fecha}`
      : sugerencia.operador === 'lte'
        ? `En o antes de ${fecha}`
        : `En o después de ${fecha}`;
    return { etiqueta: 'Fecha', detalle };
  }
  return {
    etiqueta: ETIQUETA_NUMERO[sugerencia.campo],
    detalle: `${ETIQUETA_OPERADOR[sugerencia.operador]} $${formatearCantidad(sugerencia.valor)}`,
  };
}

export function etiquetaChip(filtro: FiltroMovimiento): string {
  const { etiqueta, detalle } = etiquetaSugerencia(filtro);
  if (filtro.tipo === 'texto') return `${etiqueta}: ${detalle}`;
  if (filtro.tipo === 'fecha') return etiquetaSugerencia(filtro).detalle;
  const signo = filtro.operador === 'gte' ? '≥' : filtro.operador === 'lte' ? '≤' : '=';
  return `${etiqueta} ${signo} $${formatearCantidad(filtro.valor)}`;
}

export function mismaSugerencia(a: FiltroMovimiento, b: FiltroMovimiento): boolean {
  if (a.tipo !== b.tipo || a.campo !== b.campo) return false;
  if (a.tipo === 'texto' && b.tipo === 'texto') return normalizarBusqueda(a.valor) === normalizarBusqueda(b.valor);
  if (a.tipo === 'numerico' && b.tipo === 'numerico') return a.operador === b.operador && a.valor === b.valor;
  if (a.tipo === 'fecha' && b.tipo === 'fecha') return a.operador === b.operador && a.valor === b.valor && a.hasta === b.hasta;
  return false;
}
