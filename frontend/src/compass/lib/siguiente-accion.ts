import type { Actividad, Frente, Tarea } from "../../services/compassService"

export type SiguienteAccionResuelta = {
  frente: Frente
  origen: "tarea_explicita" | "actividad"
  titulo: string
  tarea: Tarea | null
  actividad: Actividad | null
  inicio: string | null
  fin: string | null
  duracionMinutos: number | null
  estado: "en_curso" | "reservada" | "sin_reserva"
}

function actividadVigente(actividades: Actividad[], ahora: number) {
  const programadas = actividades
    .filter((actividad) => actividad.estado === "programada" && Date.parse(actividad.fin_programado) > ahora)
    .sort((a, b) => Date.parse(a.inicio_programado) - Date.parse(b.inicio_programado))
  return programadas.find((actividad) => Date.parse(actividad.inicio_programado) <= ahora) ?? programadas[0] ?? null
}

export function resolverSiguienteAccion(
  frente: Frente,
  tareas: Tarea[],
  actividades: Actividad[],
  ahora = Date.now(),
): SiguienteAccionResuelta | null {
  const tareasDelFrente = tareas.filter((tarea) => tarea.frente_id === frente.id)
  const actividadesDelFrente = actividades.filter((actividad) => actividad.frente_id === frente.id)
  const tarea = tareasDelFrente.find((item) => item.es_siguiente_accion) ?? null
  const actividad = actividadVigente(
    tarea ? actividadesDelFrente.filter((item) => item.tarea_id === tarea.id) : actividadesDelFrente,
    ahora,
  )

  if (!tarea && !actividad) return null
  const inicio = actividad?.inicio_programado ?? null
  const fin = actividad?.fin_programado ?? null
  return {
    frente,
    origen: tarea ? "tarea_explicita" : "actividad",
    titulo: tarea?.titulo ?? actividad!.titulo,
    tarea,
    actividad,
    inicio,
    fin,
    duracionMinutos: inicio && fin ? Math.round((Date.parse(fin) - Date.parse(inicio)) / 60_000) : null,
    estado: actividad ? (Date.parse(actividad.inicio_programado) <= ahora ? "en_curso" : "reservada") : "sin_reserva",
  }
}

export function resolverSiguientesAcciones(
  frentes: Frente[],
  tareas: Tarea[],
  actividades: Actividad[],
  ahora = Date.now(),
) {
  const acciones = frentes
    .map((frente) => resolverSiguienteAccion(frente, tareas, actividades, ahora))
    .filter((accion): accion is SiguienteAccionResuelta => accion != null)

  const rango = (accion: SiguienteAccionResuelta) => {
    if (accion.estado === "en_curso") return 0
    if (accion.origen === "tarea_explicita" && accion.actividad) return 1
    if (accion.estado === "reservada") return 2
    if (accion.origen === "tarea_explicita") return 3
    return 4
  }

  return acciones.sort((a, b) => {
    const porRango = rango(a) - rango(b)
    if (porRango !== 0) return porRango
    if (a.inicio && b.inicio) return Date.parse(a.inicio) - Date.parse(b.inicio)
    if (a.inicio) return -1
    if (b.inicio) return 1
    return a.titulo.localeCompare(b.titulo, "es")
  })
}
