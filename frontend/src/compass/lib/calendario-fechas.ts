// Utilidades de fecha para el calendario. Todas trabajan sobre componentes
// UTC de una fecha "YYYY-MM-DD" para evitar corrimientos de zona horaria
// entre servidor y cliente (ver lib/format.ts para el mismo patrón).

export function sumarDias(fecha: string, dias: number) {
  const [y = 0, m = 1, d = 1] = fecha.split("-").map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  base.setUTCDate(base.getUTCDate() + dias)
  return base.toISOString().slice(0, 10)
}

/** Devuelve el lunes de la semana que contiene `fecha`. */
export function inicioDeSemana(fecha: string) {
  const [y = 0, m = 1, d = 1] = fecha.split("-").map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  const diaSemana = base.getUTCDay() // 0 = domingo
  const offset = diaSemana === 0 ? -6 : 1 - diaSemana
  base.setUTCDate(base.getUTCDate() + offset)
  return base.toISOString().slice(0, 10)
}

/** Los 7 días (lunes a domingo) de la semana que contiene `fecha`. */
export function diasDeSemana(fecha: string) {
  const lunes = inicioDeSemana(fecha)
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
}

const NOMBRES_DIA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

export function nombreDiaCorto(fecha: string) {
  const [y = 0, m = 1, d = 1] = fecha.split("-").map(Number)
  const diaSemana = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return NOMBRES_DIA[diaSemana === 0 ? 6 : diaSemana - 1]
}

export function diaDelMes(fecha: string) {
  return Number(fecha.split("-")[2])
}

/** Rango legible "3 – 9 de agosto de 2026" para la semana (lunes a domingo) que inicia en `fecha`. */
export function formatRangoSemana(fecha: string) {
  const fin = sumarDias(fecha, 6)
  const formatear = (iso: string, opciones: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("es-MX", { ...opciones, timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`))
  const mismoMes = fecha.slice(0, 7) === fin.slice(0, 7)
  const inicioLabel = formatear(fecha, mismoMes ? { day: "numeric" } : { day: "numeric", month: "long" })
  const finLabel = formatear(fin, { day: "numeric", month: "long", year: "numeric" })
  return `${inicioLabel} – ${finLabel}`
}

/** "agosto de 2026" para el mes en el que cae `fecha`. */
export function formatMesLargo(fecha: string) {
  const [y = 0, m = 1, d = 1] = fecha.split("-").map(Number)
  return new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)))
}

/** Número de semana ISO 8601 (lunes como primer día, semana 1 = la que contiene el primer jueves del año). */
export function numeroSemanaISO(fecha: string) {
  const [y = 0, m = 1, d = 1] = fecha.split("-").map(Number)
  const objetivo = new Date(Date.UTC(y, m - 1, d))
  const diaSemana = objetivo.getUTCDay() || 7
  objetivo.setUTCDate(objetivo.getUTCDate() + 4 - diaSemana)
  const inicioAno = new Date(Date.UTC(objetivo.getUTCFullYear(), 0, 1))
  return Math.ceil(((objetivo.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7)
}
