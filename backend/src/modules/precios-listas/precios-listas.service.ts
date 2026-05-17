import {
  TIPOS_PRECIO_LISTA,
  type TipoPrecioLista,
} from '../../shared/constants/precios';
import {
  actualizarPrecioListaRepository,
  crearPrecioListaRepository,
  desactivarPrecioListaRepository,
  listarPreciosListasRepository,
  obtenerPrecioListaPorIdRepository,
  type PrecioLista,
  type PrecioListaPersistedInput,
} from './precios-listas.repository';

export type PrecioListaInput = {
  nombre?: unknown;
  tipo_precio?: unknown;
  orden?: unknown;
  es_default?: unknown;
  activo?: unknown;
};

function normalizarNombre(value: unknown): string {
  const nombre = String(value ?? '').trim();
  if (!nombre) {
    throw new Error('El nombre es obligatorio');
  }
  return nombre;
}

function normalizarTipoPrecio(value: unknown): TipoPrecioLista {
  const tipoPrecio = String(value ?? '').trim().toUpperCase() as TipoPrecioLista;
  if (!TIPOS_PRECIO_LISTA.includes(tipoPrecio)) {
    throw new Error(`tipo_precio inválido. Valores permitidos: ${TIPOS_PRECIO_LISTA.join(', ')}`);
  }
  return tipoPrecio;
}

function normalizarOrden(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  const orden = Number(value);
  if (!Number.isInteger(orden)) {
    throw new Error('El orden debe ser un número entero');
  }

  return orden;
}

function normalizarActivo(value: unknown, fallback = true): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }
  return Boolean(value);
}

function normalizarPayload(payload: PrecioListaInput, fallback?: PrecioLista): PrecioListaPersistedInput {
  const activo = normalizarActivo(payload.activo, fallback?.activo ?? true);
  const esDefault = normalizarActivo(payload.es_default, fallback?.es_default ?? false);

  return {
    nombre: normalizarNombre(payload.nombre ?? fallback?.nombre),
    tipo_precio: normalizarTipoPrecio(payload.tipo_precio ?? fallback?.tipo_precio),
    orden: normalizarOrden(payload.orden ?? fallback?.orden ?? null),
    es_default: activo ? esDefault : false,
    activo,
  };
}

export async function listarPreciosListasService(
  empresaId: number,
  incluirInactivas = false
): Promise<PrecioLista[]> {
  return listarPreciosListasRepository(empresaId, incluirInactivas);
}

export async function obtenerPrecioListaPorIdService(id: number, empresaId: number): Promise<PrecioLista | null> {
  return obtenerPrecioListaPorIdRepository(id, empresaId);
}

export async function crearPrecioListaService(empresaId: number, payload: PrecioListaInput): Promise<PrecioLista> {
  return crearPrecioListaRepository(empresaId, normalizarPayload(payload));
}

export async function actualizarPrecioListaService(
  id: number,
  empresaId: number,
  payload: PrecioListaInput
): Promise<PrecioLista> {
  const actual = await obtenerPrecioListaPorIdRepository(id, empresaId);
  if (!actual) {
    throw new Error('Lista de precios no encontrada');
  }

  const actualizada = await actualizarPrecioListaRepository(id, empresaId, normalizarPayload(payload, actual));
  if (!actualizada) {
    throw new Error('Lista de precios no encontrada');
  }

  return actualizada;
}

export async function desactivarPrecioListaService(id: number, empresaId: number): Promise<PrecioLista> {
  const actual = await obtenerPrecioListaPorIdRepository(id, empresaId);
  if (!actual) {
    throw new Error('Lista de precios no encontrada');
  }
  if (!actual.activo) {
    return actual;
  }

  const desactivada = await desactivarPrecioListaRepository(id, empresaId);
  if (!desactivada) {
    throw new Error('Lista de precios no encontrada');
  }

  return desactivada;
}