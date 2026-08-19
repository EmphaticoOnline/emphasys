import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"

dayjs.extend(utc)
dayjs.extend(timezone)

export const COMPASS_TIME_ZONE = "America/Mexico_City"

const formatter = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("es-MX", { ...options, timeZone: COMPASS_TIME_ZONE })

function fechaValida(iso: string) {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) throw new Error(`Fecha ISO inválida: ${iso}`)
  return fecha
}

/** Convierte la hora de pared capturada en Compass a un instante UTC. */
export function fechaHoraLocalAISOString(valor: string) {
  const fecha = dayjs.tz(valor, COMPASS_TIME_ZONE)
  if (!fecha.isValid()) throw new Error(`Fecha y hora local inválida: ${valor}`)
  return fecha.toISOString()
}

export function fechaYHoraLocalAISOString(fecha: string, hora = "00:00") {
  return fechaHoraLocalAISOString(`${fecha}T${hora}:00`)
}

export function formatHora(iso: string) {
  return formatter({ hour: "numeric", minute: "2-digit" }).format(fechaValida(iso))
}

export function formatHora24(iso: string) {
  return formatter({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(fechaValida(iso))
}

export function formatFechaCorta(iso: string) {
  return formatter({ day: "numeric", month: "short" }).format(fechaValida(iso))
}

export function formatFechaLarga(iso: string) {
  return formatter({ weekday: "long", day: "numeric", month: "long" }).format(fechaValida(iso))
}

export function formatFechaHora(iso: string) {
  return formatter({ dateStyle: "short", timeStyle: "short" }).format(fechaValida(iso))
}

export function formatDuracionMin(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

export function duracionMinutos(inicio: string, fin: string) {
  return Math.round((fechaValida(fin).getTime() - fechaValida(inicio).getTime()) / 60000)
}

export function horasEntre(inicio: string, fin: string) {
  return duracionMinutos(inicio, fin) / 60
}

export function horaYMinuto(iso: string) {
  const parts = formatter({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(fechaValida(iso))
  return {
    hora: Number(parts.find((part) => part.type === "hour")?.value),
    minuto: Number(parts.find((part) => part.type === "minute")?.value),
  }
}

/** Fecha calendario de un instante en la zona horaria de Compass. */
export function soloFecha(iso: string) {
  const parts = formatter({ year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(fechaValida(iso))
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value
  return `${value("year")}-${value("month")}-${value("day")}`
}

export function hoyLocal() {
  return soloFecha(new Date().toISOString())
}

export function formatHorasCompacto(horas: number) {
  const h = Math.floor(horas)
  const m = Math.round((horas - h) * 60)
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}`
}

export function capitalizarPrimera(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
