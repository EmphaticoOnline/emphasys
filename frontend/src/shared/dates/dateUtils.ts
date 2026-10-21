import dayjs, { type Dayjs } from 'dayjs';

export const DATE_DISPLAY_FORMAT = 'DD/MM/YYYY';
export const DATE_TIME_DISPLAY_FORMAT = 'DD/MM/YYYY HH:mm';
export const API_DATE_FORMAT = 'YYYY-MM-DD';
export const API_DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm';

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/;
const DISPLAY_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export type DateInputValue = string | Date | Dayjs | null | undefined;

/** Convierte a Dayjs sin dejar que `dayjs()` interprete textos ambiguos (05/04/2026) como mes/día. */
function toDayjs(value: string | Date | Dayjs): Dayjs {
  if (dayjs.isDayjs(value)) return value;
  if (typeof value === 'string' && !/^\d{4}-/.test(value.trim())) {
    const iso = DISPLAY_DATE_RE.test(value.trim()) ? parseDisplayDate(value) : null;
    return iso ? dayjs(`${iso}T00:00:00`) : dayjs(NaN);
  }
  return dayjs(value);
}

const isValidDateParts = (year: number, month: number, day: number): boolean => {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day;
};

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE_RE.exec(value);
  return Boolean(match && isValidDateParts(Number(match[1]), Number(match[2]), Number(match[3])));
}

export function isValidDisplayDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DISPLAY_DATE_RE.exec(value);
  return Boolean(match && isValidDateParts(Number(match[3]), Number(match[2]), Number(match[1])));
}

export function parseDisplayDate(value: string): string | null {
  const match = DISPLAY_DATE_RE.exec(value.trim());
  if (!match || !isValidDateParts(Number(match[3]), Number(match[2]), Number(match[1]))) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function formatDateDisplay(value: DateInputValue): string {
  if (value == null) return '';
  if (typeof value === 'string' && isValidIsoDate(value)) return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
  const parsed = toDayjs(value);
  return parsed.isValid() ? parsed.format(DATE_DISPLAY_FORMAT) : '';
}

export function formatDateTimeDisplay(value: DateInputValue): string {
  if (value == null) return '';
  const parsed = toDayjs(value);
  return parsed.isValid() ? parsed.format(DATE_TIME_DISPLAY_FORMAT) : '';
}

/** Creates a local Dayjs value from a date-only ISO string, avoiding UTC parsing. */
export function dayjsFromIsoDate(value: string | null | undefined): Dayjs | null {
  return isValidIsoDate(value) ? dayjs(`${value}T00:00:00`) : null;
}

export function toApiDate(value: DateInputValue): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && isValidIsoDate(value)) return value;
  const parsed = toDayjs(value);
  return parsed.isValid() ? parsed.format(API_DATE_FORMAT) : null;
}

export function toApiDateTime(value: DateInputValue): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && ISO_DATE_TIME_RE.test(value)) return value.slice(0, 16);
  const parsed = toDayjs(value);
  return parsed.isValid() ? parsed.format(API_DATE_TIME_FORMAT) : null;
}

export function validateDateRange(from: string | null | undefined, to: string | null | undefined): string | null {
  if (from && !isValidIsoDate(from)) return 'La fecha inicial no es válida.';
  if (to && !isValidIsoDate(to)) return 'La fecha final no es válida.';
  if (from && to && from > to) return 'La fecha inicial no puede ser posterior a la fecha final.';
  return null;
}

const DISPLAY_DATE_TIME_RE = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/;

/** Aplica la máscara DD/MM/YYYY (o DD/MM/YYYY HH:mm) mientras se teclea; ignora todo lo que no sean dígitos. */
export function maskDisplayInput(raw: string, withTime = false): string {
  const digits = raw.replace(/\D/g, '').slice(0, withTime ? 12 : 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
  let out = parts.filter(Boolean).join('/');
  if (withTime && digits.length > 8) out += ` ${digits.slice(8, 10)}${digits.length > 10 ? `:${digits.slice(10, 12)}` : ''}`;
  return out;
}

/** Convierte "DD/MM/YYYY HH:mm" a "YYYY-MM-DDTHH:mm"; null si es inválida. */
export function parseDisplayDateTime(value: string): string | null {
  const match = DISPLAY_DATE_TIME_RE.exec(value.trim());
  if (!match) return null;
  const [, dd, mm, yyyy, hh, mi] = match;
  if (!isValidDateParts(Number(yyyy), Number(mm), Number(dd)) || Number(hh) > 23 || Number(mi) > 59) return null;
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

/** Muestra "YYYY-MM-DDTHH:mm" como "DD/MM/YYYY HH:mm" sin pasar por zonas horarias. */
export function formatIsoDateTimeLocalDisplay(value: string | null | undefined): string {
  const match = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}` : '';
}
