import type { ActividadEstado, Congruencia, ExpectativaAtencion } from './compass.types';

type ActividadAtencion = {
  frente_id: number | null;
  inicio_programado: string | Date;
  fin_programado: string | Date;
  estado: ActividadEstado;
  minutos_efectivos: number | null;
};

type Intervalo = { inicio: number; fin: number };

function unirMinutos(intervalos: Intervalo[]) {
  const ordenados = intervalos.filter(i => i.inicio < i.fin).sort((a, b) => a.inicio - b.inicio);
  const unidos: Intervalo[] = [];
  for (const actual of ordenados) {
    const ultimo = unidos[unidos.length - 1];
    if (!ultimo || actual.inicio > ultimo.fin) unidos.push({ ...actual });
    else ultimo.fin = Math.max(ultimo.fin, actual.fin);
  }
  return unidos.reduce((total, intervalo) => total + (intervalo.fin - intervalo.inicio) / 60_000, 0);
}

/** Separa cobertura ejecutada y futura, uniendo solapamientos por Frente. */
export function calcularAtencionPorFrente(actividades: ActividadAtencion[], ahora = new Date()) {
  const porFrente = new Map<number, { ejecutados: Intervalo[]; reservados: Intervalo[]; planificados: Intervalo[] }>();
  void ahora;

  for (const actividad of actividades) {
    if (actividad.frente_id == null || actividad.estado === 'cancelada') continue;
    const inicio = new Date(actividad.inicio_programado).getTime();
    const fin = new Date(actividad.fin_programado).getTime();
    if (!Number.isFinite(inicio) || !Number.isFinite(fin) || inicio >= fin) continue;
    const grupo = porFrente.get(actividad.frente_id) ?? { ejecutados: [], reservados: [], planificados: [] };
    grupo.planificados.push({ inicio, fin });

    if ((actividad.estado === 'realizada' || actividad.estado === 'parcial') && actividad.minutos_efectivos != null && actividad.minutos_efectivos > 0) {
      grupo.ejecutados.push({ inicio, fin: inicio + actividad.minutos_efectivos * 60_000 });
    } else if (actividad.estado === 'programada') {
      // Una actividad programada dentro de la semana sigue siendo tiempo
      // reservado aunque su fecha ya haya pasado: la revisión también es un
      // registro de lo que se planeó, no sólo de lo que aún está por ocurrir.
      grupo.reservados.push({ inicio, fin });
    }
    porFrente.set(actividad.frente_id, grupo);
  }

  return new Map([...porFrente].map(([frenteId, intervalos]) => [frenteId, {
    horas_efectivas: unirMinutos(intervalos.ejecutados) / 60,
    horas_reservadas: unirMinutos(intervalos.reservados) / 60,
    horas_planificadas: unirMinutos(intervalos.planificados) / 60,
  }]));
}

export function sugerirCongruenciaPorCobertura(
  objetivo: number | null,
  expectativa: ExpectativaAtencion | null,
  ejecutadas: number,
  reservadas: number,
): Congruencia | null {
  if (objetivo && objetivo > 0) {
    const cobertura = ejecutadas + reservadas;
    if (ejecutadas / objetivo >= 1.4) return 'sobreatendido';
    if (cobertura >= objetivo) return 'congruente';
    if (cobertura > 0) return 'en_riesgo';
    return 'descuidado';
  }
  if (expectativa === 'sin_compromiso') return 'congruente';
  if (expectativa === 'atender' || expectativa === 'prioritario') return ejecutadas > 0 || reservadas > 0 ? 'congruente' : 'descuidado';
  if (ejecutadas > 0 || reservadas > 0) return 'congruente';
  return null;
}
