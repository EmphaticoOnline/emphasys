import { darken } from '@mui/material/styles';
import type { EstadoSeguimiento } from '../../types/cotizacion';
import type { DocumentoRowAppearance } from '../documentos/documentoRowAppearance';

export type EstadoSeguimientoOption = {
  value: EstadoSeguimiento;
  label: string;
  color: string;
  textColor: string;
  rowClassName: string;
};

export const DEFAULT_ESTADO_SEGUIMIENTO: EstadoSeguimiento = 'abierta';

export const ESTADOS_SEGUIMIENTO: EstadoSeguimientoOption[] = [
  { value: 'abierta', label: 'Abierta', color: '#e0f2fe', textColor: '#075985', rowClassName: 'row-estado-abierta' },
  { value: 'pausada', label: 'Pausada', color: '#ffedd5', textColor: '#9a3412', rowClassName: 'row-estado-pausada' },
  { value: 'convertida', label: 'Convertida', color: '#dcfce7', textColor: '#166534', rowClassName: 'row-estado-convertida' },
  { value: 'perdida', label: 'Perdida', color: '#fee2e2', textColor: '#b91c1c', rowClassName: 'row-estado-perdida' },
  { value: 'no seleccionada', label: 'No seleccionada', color: '#fef3c7', textColor: '#92400e', rowClassName: 'row-estado-no-seleccionada' },
  { value: 'cancelada', label: 'Cancelada', color: '#e5e7eb', textColor: '#4b5563', rowClassName: 'row-estado-cancelada' },
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
  const normalized = toComparableValue(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return null;

  if (normalized === 'ganada' || normalized === 'ganado' || normalized === 'convertida') {
    return 'convertida';
  }

  if (normalized === 'perdido' || normalized === 'perdida') {
    return 'perdida';
  }

  if (normalized === 'no seleccionada') {
    return 'no seleccionada';
  }

  if (normalized === 'borrador' || normalized === 'enviado' || normalized === 'en negociacion' || normalized === 'negociacion' || normalized === 'cotizado') {
    return 'abierta';
  }

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

export const getEstadoSeguimientoChipBorderColor = (value: unknown): string => {
  const option = getEstadoSeguimientoOption(value);
  const baseColor = option?.color ?? getEstadoSeguimientoPresentation(value).color;
  return darken(baseColor, 0.28);
};

export const getEstadoSeguimientoRowAppearance = (value: unknown): DocumentoRowAppearance | null => {
  const option = getEstadoSeguimientoOption(value);
  return option ? { className: option.rowClassName, color: option.color } : null;
};

export const ESTADO_SEGUIMIENTO_ROW_APPEARANCES: DocumentoRowAppearance[] =
  ESTADOS_SEGUIMIENTO.map((option) => ({ className: option.rowClassName, color: option.color }));
