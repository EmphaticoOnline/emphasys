import type { EstadoSeguimiento } from '../../types/cotizacion';

export type EstadoSeguimientoOption = {
  value: EstadoSeguimiento;
  label: string;
  color: string;
  textColor: string;
  rowClassName: string;
};

export const DEFAULT_ESTADO_SEGUIMIENTO: EstadoSeguimiento = 'borrador';

export const ESTADOS_SEGUIMIENTO: EstadoSeguimientoOption[] = [
  { value: 'borrador', label: 'Borrador', color: '#f3f4f6', textColor: '#374151', rowClassName: 'row-estado-borrador' },
  { value: 'enviado', label: 'Enviado', color: '#dbeafe', textColor: '#1d4ed8', rowClassName: 'row-estado-enviado' },
  { value: 'negociacion', label: 'En negociación', color: '#fef3c7', textColor: '#92400e', rowClassName: 'row-estado-negociacion' },
  { value: 'ganado', label: 'Ganado', color: '#dcfce7', textColor: '#166534', rowClassName: 'row-estado-ganado' },
  { value: 'perdido', label: 'Perdido', color: '#fee2e2', textColor: '#b91c1c', rowClassName: 'row-estado-perdido' },
];

const ESTADOS_SEGUIMIENTO_MAP = new Map(ESTADOS_SEGUIMIENTO.map((estado) => [estado.value, estado]));

const toComparableValue = (value: unknown): string => String(value ?? '').trim().toLowerCase();

const toHumanLabel = (value: unknown): string => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return 'Sin estado';

  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const isEstadoSeguimiento = (value: unknown): value is EstadoSeguimiento =>
  ESTADOS_SEGUIMIENTO_MAP.has(toComparableValue(value) as EstadoSeguimiento);

export const normalizeEstadoSeguimiento = (value: unknown): EstadoSeguimiento | null => {
  const normalized = toComparableValue(value);
  if (!normalized) return null;
  return isEstadoSeguimiento(normalized) ? normalized : null;
};

export const getEstadoSeguimientoOption = (value: unknown): EstadoSeguimientoOption | null => {
  const normalized = normalizeEstadoSeguimiento(value);
  return normalized ? ESTADOS_SEGUIMIENTO_MAP.get(normalized) ?? null : null;
};

export const getEstadoSeguimientoPresentation = (value: unknown) => {
  const option = getEstadoSeguimientoOption(value);
  if (option) return option;

  return {
    value: null,
    label: toHumanLabel(value),
    color: '#f8fafc',
    textColor: '#64748b',
    rowClassName: 'row-estado-desconocido',
  };
};

export const getEstadoSeguimientoRowClassName = (value: unknown): string =>
  getEstadoSeguimientoPresentation(value).rowClassName;