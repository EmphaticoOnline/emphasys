"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import {
  actividades as actividadesIniciales,
  bandeja as bandejaInicial,
  decisiones as decisionesIniciales,
  frentes as frentesIniciales,
  ideas as ideasIniciales,
  intencionesSemanales as intencionesIniciales,
  medicionesSemanales as medicionesIniciales,
  paletaColoresFrente,
  SEMANA_ACTUAL,
  tareas as tareasIniciales,
} from "./data"
import type {
  Actividad,
  CapturaItem,
  Categoria,
  Decision,
  EstadoActividad,
  Frente,
  Idea,
  IntencionProximaFrente,
  IntencionSemanal,
  MedicionSemanal,
  RevisionSemanal,
  Tarea,
} from "./types"

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

interface CierreActividadInput {
  estado: EstadoActividad
  tiempoEfectivoMin?: number | undefined
  resultado?: string | undefined
}

interface CompassState {
  frentes: Frente[]
  tareas: Tarea[]
  actividades: Actividad[]
  ideas: Idea[]
  decisiones: Decision[]
  bandeja: CapturaItem[]
  intenciones: IntencionSemanal[]
  medicion: MedicionSemanal[]
  intencionesProximas: IntencionProximaFrente[]
  revisiones: RevisionSemanal[]
  addCaptura: (texto: string) => void
  descartarCaptura: (capturaId: string) => void
  convertirCapturaEnTarea: (capturaId: string, data: Partial<Tarea>) => void
  convertirCapturaEnIdea: (capturaId: string, frenteId?: string) => void
  convertirCapturaEnDecision: (capturaId: string, data: { que: string; porque: string; frenteId?: string | undefined }) => void
  convertirCapturaEnActividad: (capturaId: string, data: Partial<Actividad> & { titulo: string; inicio: string; fin: string }) => void
  convertirCapturaEnFrente: (capturaId: string, data: { nombre: string; proposito: string; categoria: Categoria }) => void
  crearFrente: (data: { nombre: string; proposito: string; categoria: Categoria }) => void
  actualizarSiguienteAccion: (frenteId: string, texto: string) => void
  toggleTarea: (tareaId: string) => void
  cerrarActividad: (actividadId: string, data: CierreActividadInput) => void
  reprogramarActividad: (actividadId: string, inicio: string, fin: string) => void
  crearActividadDesde: (actividadId: string, data: { titulo: string; inicio: string; fin: string }) => void
  crearActividad: (data: Omit<Actividad, "id" | "estado">) => void
  setIntencionProxima: (data: IntencionProximaFrente) => void
  guardarRevisionSemanal: (data: Omit<RevisionSemanal, "semanaId" | "completada">) => void
  semanaActual: typeof SEMANA_ACTUAL
}

const CompassContext = createContext<CompassState | null>(null)

export function CompassProvider({ children }: { children: ReactNode }) {
  const [frentes, setFrentes] = useState<Frente[]>(frentesIniciales)
  const [tareas, setTareas] = useState<Tarea[]>(tareasIniciales)
  const [actividades, setActividades] = useState<Actividad[]>(actividadesIniciales)
  const [ideas, setIdeas] = useState<Idea[]>(ideasIniciales)
  const [decisiones, setDecisiones] = useState<Decision[]>(decisionesIniciales)
  const [bandeja, setBandeja] = useState<CapturaItem[]>(bandejaInicial)
  const [intenciones] = useState<IntencionSemanal[]>(intencionesIniciales)
  const [medicion] = useState<MedicionSemanal[]>(medicionesIniciales)
  const [intencionesProximas, setIntencionesProximas] = useState<IntencionProximaFrente[]>([])
  const [revisiones, setRevisiones] = useState<RevisionSemanal[]>([])

  const crearFrente = useCallback((data: { nombre: string; proposito: string; categoria: Categoria }) => {
    setFrentes((prev) => {
      const color = paletaColoresFrente[prev.length % paletaColoresFrente.length] ?? "congruent"
      return [
        ...prev,
        {
          id: id("f"),
          nombre: data.nombre,
          proposito: data.proposito,
          categoria: data.categoria,
          estado: "Activo",
          siguienteAccion: "Definir la primera acción de este frente.",
          color,
        },
      ]
    })
  }, [])

  const addCaptura = useCallback((texto: string) => {
    setBandeja((prev) => [
      { id: id("c"), texto, fecha: new Date().toISOString(), procesado: false },
      ...prev,
    ])
  }, [])

  const marcarProcesada = useCallback((capturaId: string, destino: CapturaItem["destino"]) => {
    setBandeja((prev) => prev.map((c) => (c.id === capturaId ? { ...c, procesado: true, destino } : c)))
  }, [])

  const descartarCaptura = useCallback(
    (capturaId: string) => marcarProcesada(capturaId, "Descartada"),
    [marcarProcesada],
  )

  const convertirCapturaEnTarea = useCallback(
    (capturaId: string, data: Partial<Tarea>) => {
      setTareas((prev) => {
        const captura = bandeja.find((c) => c.id === capturaId)
        return [
          {
            id: id("t"),
            titulo: data.titulo ?? captura?.texto ?? "",
            estado: "Pendiente",
            ...data,
          },
          ...prev,
        ]
      })
      marcarProcesada(capturaId, "Tarea")
    },
    [bandeja, marcarProcesada],
  )

  const convertirCapturaEnIdea = useCallback(
    (capturaId: string, frenteId?: string) => {
      setIdeas((prev) => {
        const captura = bandeja.find((c) => c.id === capturaId)
        return [{ id: id("i"), texto: captura?.texto ?? "", frenteId, fecha: new Date().toISOString() }, ...prev]
      })
      marcarProcesada(capturaId, "Idea")
    },
    [bandeja, marcarProcesada],
  )

  const convertirCapturaEnDecision = useCallback(
    (capturaId: string, data: { que: string; porque: string; frenteId?: string | undefined }) => {
      setDecisiones((prev) => [{ id: id("d"), fecha: new Date().toISOString(), ...data }, ...prev])
      marcarProcesada(capturaId, "Decision")
    },
    [marcarProcesada],
  )

  const convertirCapturaEnActividad = useCallback(
    (capturaId: string, data: Partial<Actividad> & { titulo: string; inicio: string; fin: string }) => {
      setActividades((prev) => [{ id: id("a"), estado: "Programada", ...data }, ...prev])
      marcarProcesada(capturaId, "Actividad")
    },
    [marcarProcesada],
  )

  const convertirCapturaEnFrente = useCallback(
    (capturaId: string, data: { nombre: string; proposito: string; categoria: Categoria }) => {
      crearFrente(data)
      marcarProcesada(capturaId, "Frente")
    },
    [crearFrente, marcarProcesada],
  )

  const actualizarSiguienteAccion = useCallback((frenteId: string, texto: string) => {
    setFrentes((prev) => prev.map((f) => (f.id === frenteId ? { ...f, siguienteAccion: texto } : f)))
  }, [])

  const toggleTarea = useCallback((tareaId: string) => {
    setTareas((prev) =>
      prev.map((t) => (t.id === tareaId ? { ...t, estado: t.estado === "Pendiente" ? "Completada" : "Pendiente" } : t)),
    )
  }, [])

  const cerrarActividad = useCallback((actividadId: string, data: CierreActividadInput) => {
    setActividades((prev) => prev.map((a) => (a.id === actividadId ? { ...a, ...data } : a)))
  }, [])

  const reprogramarActividad = useCallback((actividadId: string, inicio: string, fin: string) => {
    setActividades((prev) => {
      const original = prev.find((a) => a.id === actividadId)
      if (!original) return prev
      const copia: Actividad = {
        ...original,
        id: id("a"),
        inicio,
        fin,
        estado: "Programada",
        tiempoEfectivoMin: undefined,
        resultado: undefined,
        reprogramadaDeId: actividadId,
      }
      return [copia, ...prev.map((a) => (a.id === actividadId ? { ...a, estado: "Cancelada" as const } : a))]
    })
  }, [])

  const crearActividadDesde = useCallback(
    (actividadId: string, data: { titulo: string; inicio: string; fin: string }) => {
      setActividades((prev) => {
        const original = prev.find((a) => a.id === actividadId)
        return [
          {
            id: id("a"),
            titulo: data.titulo,
            inicio: data.inicio,
            fin: data.fin,
            estado: "Programada",
            frenteId: original?.frenteId,
            tareaId: original?.tareaId,
            creadaDesdeId: actividadId,
          },
          ...prev,
        ]
      })
    },
    [],
  )

  const crearActividad = useCallback((data: Omit<Actividad, "id" | "estado">) => {
    setActividades((prev) => [{ id: id("a"), estado: "Programada", ...data }, ...prev])
  }, [])

  const setIntencionProxima = useCallback((data: IntencionProximaFrente) => {
    setIntencionesProximas((prev) => [data, ...prev.filter((i) => i.frenteId !== data.frenteId)])
  }, [])

  const guardarRevisionSemanal = useCallback(
    (data: Omit<RevisionSemanal, "semanaId" | "completada">) => {
      setRevisiones((prev) => [{ ...data, semanaId: SEMANA_ACTUAL.id, completada: true }, ...prev])
    },
    [],
  )

  const value = useMemo<CompassState>(
    () => ({
      frentes,
      tareas,
      actividades,
      ideas,
      decisiones,
      bandeja,
      intenciones,
      medicion,
      intencionesProximas,
      revisiones,
      addCaptura,
      descartarCaptura,
      convertirCapturaEnTarea,
      convertirCapturaEnIdea,
      convertirCapturaEnDecision,
      convertirCapturaEnActividad,
      convertirCapturaEnFrente,
      crearFrente,
      actualizarSiguienteAccion,
      toggleTarea,
      cerrarActividad,
      reprogramarActividad,
      crearActividadDesde,
      crearActividad,
      setIntencionProxima,
      guardarRevisionSemanal,
      semanaActual: SEMANA_ACTUAL,
    }),
    [
      frentes,
      tareas,
      actividades,
      ideas,
      decisiones,
      bandeja,
      intenciones,
      medicion,
      intencionesProximas,
      revisiones,
      addCaptura,
      descartarCaptura,
      convertirCapturaEnTarea,
      convertirCapturaEnIdea,
      convertirCapturaEnDecision,
      convertirCapturaEnActividad,
      convertirCapturaEnFrente,
      crearFrente,
      actualizarSiguienteAccion,
      toggleTarea,
      cerrarActividad,
      reprogramarActividad,
      crearActividadDesde,
      crearActividad,
      setIntencionProxima,
      guardarRevisionSemanal,
    ],
  )

  return <CompassContext.Provider value={value}>{children}</CompassContext.Provider>
}

export function useCompass() {
  const ctx = useContext(CompassContext)
  if (!ctx) throw new Error("useCompass debe usarse dentro de CompassProvider")
  return ctx
}
