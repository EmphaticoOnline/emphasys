import { sumarDias } from "./calendario-fechas"
import { fechaYHoraLocalAISOString } from "./format"
import type { Actividad } from "../../services/compassService"

export const HORA_INICIO_JORNADA = 7
/** Límite exclusivo: 24 representa las 00:00 del día siguiente. */
export const HORA_FIN_JORNADA = 24
export const DIAS_LABORALES = 5

export type DisponibilidadDia = {
  fecha: string
  minutosDisponibles: number
  minutosOcupados: number
}

export type DisponibilidadSemanal = {
  minutosDisponibles: number
  dias: DisponibilidadDia[]
}

type Intervalo = { inicio: number; fin: number }

function unirIntervalos(intervalos: Intervalo[]) {
  const ordenados = [...intervalos].sort((a, b) => a.inicio - b.inicio)
  const unidos: Intervalo[] = []

  for (const actual of ordenados) {
    const ultimo = unidos.at(-1)
    if (!ultimo || actual.inicio > ultimo.fin) unidos.push({ ...actual })
    else ultimo.fin = Math.max(ultimo.fin, actual.fin)
  }

  return unidos
}

/**
 * Calcula capacidad derivada para lunes-viernes dentro de la jornada de Compass.
 * Todas las actividades salvo las canceladas reservan su intervalo programado.
 */
export function calcularDisponibilidadSemanal(
  actividades: Actividad[],
  semanaInicio: string,
  ahora = new Date(),
): DisponibilidadSemanal {
  const dias = Array.from({ length: DIAS_LABORALES }, (_, indice) => {
    const fecha = sumarDias(semanaInicio, indice)
    const inicioJornada = Date.parse(fechaYHoraLocalAISOString(fecha, `${String(HORA_INICIO_JORNADA).padStart(2, "0")}:00`))
    const finJornada = Date.parse(fechaYHoraLocalAISOString(sumarDias(fecha, 1), "00:00"))
    const inicioUtilizable = Math.max(inicioJornada, ahora.getTime())
    if (inicioUtilizable >= finJornada) {
      return { fecha, minutosOcupados: 0, minutosDisponibles: 0 }
    }

    const intervalos = actividades
      .filter((actividad) => actividad.estado !== "cancelada")
      .map((actividad) => ({ inicio: Date.parse(actividad.inicio_programado), fin: Date.parse(actividad.fin_programado) }))
      .filter(({ inicio, fin }) => Number.isFinite(inicio) && Number.isFinite(fin) && inicio < finJornada && fin > inicioUtilizable)
      .map(({ inicio, fin }) => ({ inicio: Math.max(inicio, inicioUtilizable), fin: Math.min(fin, finJornada) }))
    const minutosOcupados = unirIntervalos(intervalos)
      .reduce((total, intervalo) => total + (intervalo.fin - intervalo.inicio) / 60_000, 0)

    return {
      fecha,
      minutosOcupados: Math.round(minutosOcupados),
      minutosDisponibles: Math.max(0, Math.round((finJornada - inicioUtilizable) / 60_000 - minutosOcupados)),
    }
  })

  return {
    dias,
    minutosDisponibles: dias.reduce((total, dia) => total + dia.minutosDisponibles, 0),
  }
}

export function opcionesRapidasHoras(minutosDisponibles: number) {
  const disponibles = Math.floor(minutosDisponibles / 15) / 4
  const candidatos = [2, 4, 6].filter((horas) => horas < disponibles)
  if (disponibles > 0) candidatos.push(disponibles)
  return [...new Set(candidatos)]
}
