import type { DbClient } from './transporte.repository';

/** Zona usada cuando la empresa no tiene `zona_horaria` configurada. */
export const ZONA_HORARIA_FALLBACK = 'America/Mexico_City';

const NAIVE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;
const CON_ZONA = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

export async function zonaEmpresa(client: DbClient, empresaId: number): Promise<string> {
  const { rows } = await client.query<{ zona_horaria: string | null }>(
    'SELECT zona_horaria FROM core.empresas WHERE id = $1',
    [empresaId],
  );
  const zona = String(rows[0]?.zona_horaria ?? '').trim();
  return zona || ZONA_HORARIA_FALLBACK;
}

const partesZona = (date: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const leer = (tipo: Intl.DateTimeFormatPartTypes): number => Number(parts.find((parte) => parte.type === tipo)?.value ?? '0');
  const hour = leer('hour');
  return {
    year: leer('year'),
    month: leer('month'),
    day: leer('day'),
    hour: hour === 24 ? 0 : hour,
    minute: leer('minute'),
    second: leer('second'),
  };
};

const offsetMs = (date: Date, timeZone: string): number => {
  const pared = partesZona(date, timeZone);
  const comoUtc = Date.UTC(pared.year, pared.month - 1, pared.day, pared.hour, pared.minute, pared.second);
  return comoUtc - date.getTime();
};

/** Hora de pared `YYYY-MM-DDTHH:mm` en `timeZone`, sin offset. */
export function instanteAHoraPared(value: unknown, timeZone: string): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && NAIVE.test(value) && !CON_ZONA.test(value.trim())) {
    const match = NAIVE.exec(value.trim());
    if (!match) return null;
    return `${match[1]}T${match[2]}:${match[3]}`;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  const pared = partesZona(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pared.year}-${pad(pared.month)}-${pad(pared.day)}T${pad(pared.hour)}:${pad(pared.minute)}`;
}

/** Interpreta una hora de pared en `timeZone` como instante absoluto. */
export function horaParedAInstante(value: string | null | undefined, timeZone: string): Date | null {
  if (value == null || value.trim() === '') return null;
  const text = value.trim();
  if (CON_ZONA.test(text)) {
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }
  const match = NAIVE.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? '0');
  const utcPared = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = utcPared - offsetMs(new Date(utcPared), timeZone);
  const ajustado = utcPared - offsetMs(new Date(instant), timeZone);
  if (ajustado !== instant) instant = ajustado;
  return new Date(instant);
}

export function presentarHorasUbicacion<T extends { ubicaciones?: Array<Record<string, unknown>> }>(aggregate: T, timeZone: string): T {
  if (!aggregate.ubicaciones) return aggregate;
  return {
    ...aggregate,
    ubicaciones: aggregate.ubicaciones.map((ubicacion) => ({
      ...ubicacion,
      fecha_hora_programada: instanteAHoraPared(ubicacion.fecha_hora_programada, timeZone),
      fecha_hora_real: ubicacion.fecha_hora_real == null ? ubicacion.fecha_hora_real : instanteAHoraPared(ubicacion.fecha_hora_real, timeZone),
    })),
  };
}
