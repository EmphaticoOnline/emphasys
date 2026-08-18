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
