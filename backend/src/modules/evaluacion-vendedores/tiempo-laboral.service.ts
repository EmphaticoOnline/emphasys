import type { HorarioLaboral, ExcepcionLaboral } from './metricas.repository';

type PartesLocales = { year: number; month: number; day: number; hour: number; minute: number; second: number };
const partes = (instant: Date, timeZone: string): PartesLocales => {
  const values = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(instant);
  const get = (type: string) => Number(values.find((item) => item.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute'), second: get('second') };
};
const claveFecha = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const offsetMs = (instant: Date, timeZone: string) => { const p = partes(instant, timeZone); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant.getTime(); };
const localAUtc = (date: string, time: string, timeZone: string) => {
  const [year, month, day] = date.split('-').map(Number); const [hour, minute, second = 0] = time.split(':').map(Number);
  let instant = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  for (let i = 0; i < 3; i += 1) instant = new Date(Date.UTC(year, month - 1, day, hour, minute, second) - offsetMs(instant, timeZone));
  return instant;
};
const fechaSiguiente = (date: string) => { const [y, m, d] = date.split('-').map(Number); const next = new Date(Date.UTC(y, m - 1, d + 1)); return claveFecha(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()); };
const fechaAnterior = (date: string) => { const [y, m, d] = date.split('-').map(Number); const previous = new Date(Date.UTC(y, m - 1, d - 1)); return claveFecha(previous.getUTCFullYear(), previous.getUTCMonth() + 1, previous.getUTCDate()); };
const diaSemana = (date: string) => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };

export function calcularSegundosLaborales(inicio: Date, fin: Date, config: { zona_horaria: string | null; horarios: HorarioLaboral[]; excepciones: ExcepcionLaboral[] }): number {
  if (!(inicio instanceof Date) || !(fin instanceof Date) || Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || fin <= inicio || !config.zona_horaria) return 0;
  const zona = config.zona_horaria; const horarios = new Map(config.horarios.map((h) => [h.dia_semana, h])); const excepciones = new Map(config.excepciones.map((x) => [x.fecha, x]));
  let local = partes(inicio, zona); let fecha = claveFecha(local.year, local.month, local.day); const fechaFin = partes(fin, zona); const ultimaFecha = claveFecha(fechaFin.year, fechaFin.month, fechaFin.day); let total = 0;
  while (true) {
    const excepcion = excepciones.get(fecha); const horario = excepcion?.tipo === 'inhabil' ? null : excepcion?.tipo === 'horario_especial' ? excepcion : horarios.get(diaSemana(fecha));
    const horaInicio = horario?.hora_inicio ?? null; const horaFin = horario?.hora_fin ?? null;
    const horarioActivo = horario && 'activo' in horario ? horario.activo : true;
    if (horario && horarioActivo && horaInicio && horaFin) {
      const ventanaInicio = localAUtc(fecha, horaInicio, zona); const ventanaFin = localAUtc(fecha, horaFin, zona);
      const desde = Math.max(inicio.getTime(), ventanaInicio.getTime()); const hasta = Math.min(fin.getTime(), ventanaFin.getTime()); if (hasta > desde) total += hasta - desde;
    }
    if (fecha === ultimaFecha) break; fecha = fechaSiguiente(fecha); local = partes(new Date(localAUtc(fecha, '00:00:00', zona)), zona); if (!local) break;
  }
  return Math.floor(total / 1000);
}

export function obtenerFechaLocalAnterior(date: string): string { return fechaAnterior(date); }
