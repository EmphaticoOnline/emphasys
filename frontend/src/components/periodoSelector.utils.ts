// Lógica del selector de periodo (año y mes), separada del componente para probarla sola.

/** Periodo elegido: un mes de un año, o el año completo (mes = null). */
export type Periodo = { anio: number; mes: number | null };

export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] as const;
export const MESES_LARGOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

export function periodoActual(hoy = new Date()): Periodo {
  return { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 };
}

/** Avanza o retrocede un mes (cruzando de año); con el año completo, avanza o retrocede un año. */
export function moverPeriodo(periodo: Periodo, paso: 1 | -1): Periodo {
  if (periodo.mes == null) return { anio: periodo.anio + paso, mes: null };
  const indice = periodo.anio * 12 + (periodo.mes - 1) + paso;
  return { anio: Math.floor(indice / 12), mes: (indice % 12) + 1 };
}

export function etiquetaPeriodo(periodo: Periodo): string {
  const mes = periodo.mes == null ? undefined : MESES_LARGOS[periodo.mes - 1];
  return mes ? `${mes.toLowerCase()} ${periodo.anio}` : `todo ${periodo.anio}`;
}

/** Años a ofrecer: los que tienen datos y el del periodo elegido, del más reciente al más antiguo. */
export function aniosDisponibles(conteos: { anio: number }[], periodo: Periodo, hoy = new Date()): number[] {
  const anios = new Set(conteos.map((c) => c.anio));
  anios.add(periodo.anio);
  anios.add(hoy.getFullYear());
  return Array.from(anios).sort((a, b) => b - a);
}

/** Último periodo (mes) con datos, para ofrecerlo cuando el elegido está vacío. */
export function ultimoPeriodoConDatos(conteos: { anio: number; mes: number; total: number }[]): Periodo | null {
  const conDatos = conteos.filter((c) => c.total > 0);
  if (!conDatos.length) return null;
  const ultimo = conDatos.reduce((a, b) => (b.anio * 12 + b.mes > a.anio * 12 + a.mes ? b : a));
  return { anio: ultimo.anio, mes: ultimo.mes };
}
