"use client"

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { CerrarActividadDrawer } from "@/components/actividad/cerrar-actividad-drawer"
import { diasDeSemana, nombreDiaCorto, sumarDias } from "@/lib/calendario-fechas"
import { useRealWork } from "@/lib/real-work-store"
import { colorVarDeFrente } from "@/lib/frente-color"
import { fechaYHoraLocalAISOString, formatDuracionMin, formatHora24, hoyLocal, horaYMinuto, soloFecha } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Actividad, ActividadEstado, Frente } from "../../../services/compassService"
import { ActividadBloque } from "./actividad-bloque"
import { ActividadDetallePanel, type ModoGestion } from "./actividad-detalle-panel"
import { ESTADO_GLYPH, ESTADO_LABEL, decoracionEstado } from "./estado-actividad-visual"

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const ESTADOS_LEYENDA: ActividadEstado[] = ["programada", "realizada", "parcial", "no_realizada", "cancelada"]
const HORA_MIN_DEFAULT = 7
const HORA_MAX_DEFAULT = 21
const ALTURA_HORA = 56

function horaFraccional(iso: string) {
  const { hora, minuto } = horaYMinuto(iso)
  return hora + minuto / 60
}

function diaLabel(ymd: string) {
  const d = new Date(`${ymd}T12:00:00`)
  return { dow: nombreDiaCorto(ymd)!.toUpperCase(), num: d.getDate(), largo: d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }) }
}

/** Asigna cada actividad de un día a un carril, agrupando por clusters de solapamiento transitivo. */
function asignarCarriles(actividades: Actividad[]) {
  const ordenadas = [...actividades].sort((a, b) => a.inicio_programado.localeCompare(b.inicio_programado))
  const resultado = new Map<number, { carril: number; carriles: number }>()
  let cluster: Actividad[] = []
  let finClusterMax = ""

  const cerrarCluster = () => {
    if (cluster.length === 0) return
    const finesCarril: string[] = []
    for (const act of cluster) {
      let carril = finesCarril.findIndex((fin) => fin <= act.inicio_programado)
      if (carril === -1) { carril = finesCarril.length; finesCarril.push(act.fin_programado) } else finesCarril[carril] = act.fin_programado
      resultado.set(act.id, { carril, carriles: 0 })
    }
    for (const act of cluster) resultado.get(act.id)!.carriles = finesCarril.length
    cluster = []
  }

  for (const act of ordenadas) {
    if (cluster.length === 0 || act.inicio_programado < finClusterMax) {
      cluster.push(act)
      if (act.fin_programado > finClusterMax) finClusterMax = act.fin_programado
    } else {
      cerrarCluster()
      cluster = [act]
      finClusterMax = act.fin_programado
    }
  }
  cerrarCluster()
  return resultado
}

function ActividadMobileItem({ actividad, frentes, onSelect }: { actividad: Actividad; frentes: Frente[]; onSelect: (a: Actividad) => void }) {
  const color = colorVarDeFrente(frentes, actividad.frente_id)
  const deco = decoracionEstado(actividad.estado, color)
  return (
    <div className="flex items-stretch gap-3">
      <div className="flex w-11 shrink-0 flex-col items-end gap-0.5 pt-2.5">
        <span className="font-mono-compass text-xs text-foreground">{formatHora24(actividad.inicio_programado)}</span>
        <span className="font-mono-compass text-[10px] text-muted-foreground">{formatHora24(actividad.fin_programado)}</span>
      </div>
      <button
        type="button"
        onClick={() => onSelect(actividad)}
        className="min-w-0 flex-1 rounded-2xl px-3.5 py-3 text-left"
        style={{ border: deco.border, background: deco.background }}
      >
        <div className="flex items-start justify-between gap-2">
          <span className={cn("text-[14.5px] leading-snug font-semibold text-pretty", deco.textoAtenuado ? "text-muted-foreground" : "text-foreground", deco.tachado && "line-through")}>
            {actividad.titulo}
          </span>
          <span className="flex size-[19px] shrink-0 items-center justify-center rounded-full border border-border bg-card text-[10px] text-foreground/80" aria-hidden>
            {ESTADO_GLYPH[actividad.estado]}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="size-[7px] shrink-0 rounded-sm" style={{ background: color }} aria-hidden />
          <span className="truncate text-xs text-muted-foreground">{actividad.frente_nombre ?? "Sin Frente"}</span>
          <span className="ml-auto font-mono-compass text-[9.5px] tracking-[0.06em] text-muted-foreground/80">
            {formatDuracionMin(Math.round((new Date(actividad.fin_programado).getTime() - new Date(actividad.inicio_programado).getTime()) / 60000))}
          </span>
        </div>
        {actividad.tarea_titulo && <div className="mt-1 truncate pl-[13px] text-xs text-muted-foreground">↳ {actividad.tarea_titulo}</div>}
      </button>
    </div>
  )
}

export function CalendarioView() {
  const { actividades, frentes, tareas, loading, error, loadActividades, loadFrentes, loadTareas, crearActividad, actualizarActividad, eliminarActividad } = useRealWork()
  const [fecha, setFecha] = useState(hoyLocal)
  const dias = useMemo(() => diasDeSemana(fecha), [fecha])
  const hoy = hoyLocal()
  const [diaMovil, setDiaMovil] = useState(() => Math.max(0, dias.indexOf(hoy)))

  const [seleccionada, setSeleccionada] = useState<Actividad | null>(null)
  const [gestion, setGestion] = useState<{ actividad: Actividad; modo: ModoGestion } | null>(null)
  const [creando, setCreando] = useState<string | null>(null)
  const [editando, setEditando] = useState<Actividad | null>(null)
  const [cambiosTemporales, setCambiosTemporales] = useState<Map<number, Actividad>>(new Map())
  const [actionError, setActionError] = useState("")
  const [titulo, setTitulo] = useState("")
  const [diaForm, setDiaForm] = useState(0)
  const [inicio, setInicio] = useState("09:00")
  const [fin, setFin] = useState("10:00")
  const [frenteId, setFrenteId] = useState("")
  const [tareaId, setTareaId] = useState("")

  const load = useCallback(() => loadActividades({
    fecha_inicio: fechaYHoraLocalAISOString(dias[0]!),
    fecha_fin: fechaYHoraLocalAISOString(sumarDias(dias[6]!, 1)),
  }), [dias, loadActividades])
  useEffect(() => { void loadFrentes() }, [loadFrentes])
  useEffect(() => { void loadTareas() }, [loadTareas])
  useEffect(() => { void load() }, [load])
  useEffect(() => { setDiaMovil((i) => (dias.includes(hoy) ? dias.indexOf(hoy) : Math.min(i, 6))) }, [dias, hoy])

  const actividadesVisibles = useMemo(() => actividades.map((actividad) => cambiosTemporales.get(actividad.id) ?? actividad), [actividades, cambiosTemporales])

  const porDia = useMemo(() => {
    const mapa = new Map<string, Actividad[]>()
    for (const dia of dias) mapa.set(dia, [])
    for (const act of actividadesVisibles) {
      const key = soloFecha(act.inicio_programado)
      mapa.get(key)?.push(act)
    }
    return mapa
  }, [actividadesVisibles, dias])

  const [horaMin, horaMax] = useMemo(() => {
    let min = HORA_MIN_DEFAULT
    let max = HORA_MAX_DEFAULT
    for (const act of actividadesVisibles) {
      min = Math.min(min, Math.floor(horaFraccional(act.inicio_programado)))
      max = Math.max(max, Math.ceil(horaFraccional(act.fin_programado)))
    }
    return [min, max]
  }, [actividadesVisibles])

  const horas = useMemo(() => {
    const lista: string[] = []
    for (let h = horaMin; h <= horaMax; h++) lista.push(`${h < 10 ? "0" : ""}${h}:00`)
    return lista
  }, [horaMin, horaMax])

  const semanaActual = dias.includes(hoy)
  const totalSemana = actividadesVisibles.length
  const primerDia = dias[0]!
  const ultimoDia = dias[6]!
  const dFrom = new Date(`${primerDia}T12:00:00`)
  const dTo = new Date(`${ultimoDia}T12:00:00`)
  const weekLabel = `${dFrom.getDate()}–${dTo.getDate()} ${MESES[dTo.getMonth()]} ${dTo.getFullYear()}`

  const abrirCrear = (dia: string) => { setCreando(dia); setEditando(null); setDiaForm(dias.indexOf(dia)); setTitulo(""); setInicio("09:00"); setFin("10:00"); setFrenteId(""); setTareaId("") }

  const abrirEdicion = (actividad: Actividad) => {
    const dia = soloFecha(actividad.inicio_programado)
    setEditando(actividad)
    setSeleccionada(null)
    setCreando(null)
    setDiaForm(Math.max(0, dias.indexOf(dia)))
    setTitulo(actividad.titulo)
    setInicio(formatHora24(actividad.inicio_programado))
    setFin(formatHora24(actividad.fin_programado))
    setFrenteId(actividad.frente_id == null ? "" : String(actividad.frente_id))
    setTareaId(actividad.tarea_id == null ? "" : String(actividad.tarea_id))
  }

  const persistirHorario = async (actividad: Actividad, inicioProgramado: string, finProgramado: string) => {
    const optimista = { ...actividad, inicio_programado: inicioProgramado, fin_programado: finProgramado }
    setActionError("")
    setCambiosTemporales((actuales) => new Map(actuales).set(actividad.id, optimista))
    try {
      await actualizarActividad(actividad.id, { inicio_programado: inicioProgramado, fin_programado: finProgramado })
      await load()
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "No se pudo guardar el cambio. La actividad volvió a su horario anterior.")
      await load().catch(() => undefined)
    } finally {
      setCambiosTemporales((actuales) => { const next = new Map(actuales); next.delete(actividad.id); return next })
    }
  }

  const redimensionar = (actividad: Actividad, edge: "inicio" | "fin", deltaMinutes: number) => {
    const inicioActual = new Date(actividad.inicio_programado).getTime()
    const finActual = new Date(actividad.fin_programado).getTime()
    const delta = deltaMinutes * 60_000
    const nuevoInicio = edge === "inicio" ? inicioActual + delta : inicioActual
    const nuevoFin = edge === "fin" ? finActual + delta : finActual
    if (nuevoFin <= nuevoInicio) { setActionError("La actividad debe durar al menos 15 minutos."); return }
    void persistirHorario(actividad, new Date(nuevoInicio).toISOString(), new Date(nuevoFin).toISOString())
  }

  const soltarActividad = (event: DragEvent<HTMLDivElement>, dia: string) => {
    event.preventDefault()
    const id = Number(event.dataTransfer.getData("application/x-compass-actividad"))
    const actividad = actividadesVisibles.find((item) => item.id === id)
    if (!actividad || actividad.estado !== "programada") return
    const rect = event.currentTarget.getBoundingClientRect()
    const minutosDesdeInicio = Math.round((((event.clientY - rect.top) / ALTURA_HORA) * 60) / 15) * 15
    const minutoDia = Math.max(0, Math.min(24 * 60 - 15, horaMin * 60 + minutosDesdeInicio))
    const duration = new Date(actividad.fin_programado).getTime() - new Date(actividad.inicio_programado).getTime()
    const hora = `${String(Math.floor(minutoDia / 60)).padStart(2, "0")}:${String(minutoDia % 60).padStart(2, "0")}`
    const nuevoInicio = fechaYHoraLocalAISOString(dia, hora)
    void persistirHorario(actividad, nuevoInicio, new Date(new Date(nuevoInicio).getTime() + duration).toISOString())
  }

  async function guardarCreacion() {
    if (!creando || !titulo.trim()) return
    const diaElegido = dias[diaForm] ?? creando
    await crearActividad({
      titulo: titulo.trim(),
      frente_id: frenteId ? Number(frenteId) : null,
      tarea_id: tareaId ? Number(tareaId) : null,
      inicio_programado: fechaYHoraLocalAISOString(diaElegido, inicio),
      fin_programado: fechaYHoraLocalAISOString(diaElegido, fin),
    })
    setCreando(null)
    await load()
  }

  async function guardarEdicion() {
    if (!editando || !titulo.trim()) return
    const diaElegido = dias[diaForm] ?? soloFecha(editando.inicio_programado)
    try {
      setActionError("")
      await actualizarActividad(editando.id, {
        titulo: titulo.trim(),
        frente_id: frenteId ? Number(frenteId) : null,
        tarea_id: tareaId ? Number(tareaId) : null,
        inicio_programado: fechaYHoraLocalAISOString(diaElegido, inicio),
        fin_programado: fechaYHoraLocalAISOString(diaElegido, fin),
      })
      setEditando(null)
      await load()
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "No se pudieron guardar los cambios.")
      await load().catch(() => undefined)
    }
  }

  async function confirmarEliminacion(actividad: Actividad) {
    if (!window.confirm(`¿Eliminar “${actividad.titulo}”? Esta acción no se puede deshacer.`)) return
    try {
      setActionError("")
      await eliminarActividad(actividad.id)
      setSeleccionada(null)
      await load()
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "No se pudo eliminar la actividad.")
      await load().catch(() => undefined)
    }
  }

  const abrirGestion = (modo: ModoGestion) => { if (seleccionada) { setGestion({ actividad: seleccionada, modo }); setSeleccionada(null) } }

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl bg-gradient-to-b from-[var(--surface-header)] to-[var(--surface-header-end)] px-5 py-4 md:px-8 md:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-editorial text-4xl leading-[0.95] tracking-tight text-foreground md:text-5xl">Calendario</h1>
            <div className="flex items-center gap-2.5">
              <span className="font-mono-compass text-[11px] tracking-[0.1em] text-muted-foreground uppercase">{weekLabel}</span>
              <span className="h-3 w-px bg-border" />
              <span className="font-mono-compass text-[10.5px] tracking-[0.1em] text-muted-foreground/70 uppercase">
                {semanaActual ? "Semana actual" : "America/Mexico_City · 24h"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex overflow-hidden rounded-[11px] border border-border bg-card">
              <button type="button" onClick={() => setFecha((f) => sumarDias(f, -7))} className="flex h-9 w-9 items-center justify-center text-foreground/80 hover:bg-muted" aria-label="Semana anterior">
                <ChevronLeft className="size-4" />
              </button>
              <span className="w-px bg-border" />
              <button type="button" onClick={() => setFecha((f) => sumarDias(f, 7))} className="flex h-9 w-9 items-center justify-center text-foreground/80 hover:bg-muted" aria-label="Semana siguiente">
                <ChevronRight className="size-4" />
              </button>
            </div>
            <Button variant="outline" onClick={() => setFecha(hoyLocal())} disabled={semanaActual} className="min-h-9">Semana actual</Button>
            <Button onClick={() => abrirCrear(hoy && dias.includes(hoy) ? hoy : dias[0]!)} className="min-h-11 md:min-h-9"><Plus />Nueva actividad</Button>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-[var(--surface-sunken)] px-4 py-2.5">
        <span className="font-mono-compass text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Estados</span>
        {ESTADOS_LEYENDA.map((estado) => (
          <span key={estado} className="flex items-center gap-1.5">
            <span className="flex size-[17px] items-center justify-center rounded-full border border-border bg-card text-[10px] text-foreground/80" aria-hidden>{ESTADO_GLYPH[estado]}</span>
            <span className="text-xs text-muted-foreground">{ESTADO_LABEL[estado]}</span>
          </span>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-card px-5 py-5">
          <p className="font-editorial text-lg text-destructive">No pudimos cargar tu calendario</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => void load()}>Reintentar</Button>
        </div>
      )}

      {actionError && <p role="alert" className="rounded-xl border border-destructive/30 bg-card px-4 py-3 text-sm text-destructive">{actionError}</p>}

      {!error && loading && actividades.length === 0 && (
        <div className="h-[420px] animate-pulse rounded-2xl border border-border bg-[var(--surface-sunken)]" />
      )}

      {!error && !(loading && actividades.length === 0) && totalSemana === 0 && (
        <Empty className="rounded-2xl bg-[var(--surface-sunken)] py-8">
          <EmptyHeader>
            <EmptyTitle className="font-editorial text-xl font-normal">Semana sin actividades.</EmptyTitle>
            <EmptyDescription>Programa la primera actividad de la semana para empezar a ver cómo se usa el tiempo.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => abrirCrear(dias[0]!)}><Plus />Nueva actividad</Button>
          </EmptyContent>
        </Empty>
      )}

      {!error && !(loading && actividades.length === 0) && totalSemana > 0 && (
        <>
          {/* Desktop: rejilla semanal */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
            <div className="flex border-b border-border">
              <div className="w-14 shrink-0 border-r border-border" />
              {dias.map((dia) => {
                const { dow, num } = diaLabel(dia)
                const esHoy = dia === hoy
                return (
                  <div key={dia} className={cn("flex flex-1 items-baseline justify-between gap-2 border-r border-border px-3 py-2.5 last:border-r-0", esHoy && "bg-[var(--surface-sunken)]")}>
                    <span className="flex items-baseline gap-2">
                      <span className={cn("font-mono-compass text-[10px] tracking-[0.12em]", esHoy ? "text-primary" : "text-muted-foreground")}>{dow}</span>
                      <span className={cn("font-editorial text-xl leading-none", esHoy ? "text-primary" : "text-foreground")}>{num}</span>
                    </span>
                    <button type="button" onClick={() => abrirCrear(dia)} aria-label={`Agendar el ${num}`} className="flex size-[22px] items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground">
                      <Plus className="size-3" />
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="flex max-h-[620px] overflow-y-auto">
              <div className="w-14 shrink-0 border-r border-border bg-[var(--surface-sunken)]">
                {horas.map((h) => (
                  <div key={h} className="flex justify-end pr-2" style={{ height: ALTURA_HORA }}>
                    <span className="-translate-y-2 font-mono-compass text-[10px] text-muted-foreground">{h}</span>
                  </div>
                ))}
              </div>
              {dias.map((dia) => {
                const actsDia = porDia.get(dia) ?? []
                const carriles = asignarCarriles(actsDia)
                const alturaTotal = (horas.length - 1) * ALTURA_HORA
                return (
                  <div
                    key={dia}
                    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move" }}
                    onDrop={(event) => soltarActividad(event, dia)}
                    className="relative flex-1 border-r border-border last:border-r-0"
                    style={{
                      height: alturaTotal,
                      backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${ALTURA_HORA - 1}px, var(--border) ${ALTURA_HORA - 1}px ${ALTURA_HORA}px)`,
                    }}
                  >
                    {actsDia.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-mono-compass text-[10px] tracking-[0.1em] text-muted-foreground/50 uppercase">Sin actividades</span>
                      </div>
                    )}
                    {actsDia.map((act) => {
                      const lane = carriles.get(act.id) ?? { carril: 0, carriles: 1 }
                      const top = (horaFraccional(act.inicio_programado) - horaMin) * ALTURA_HORA
                      const alto = Math.max(34, (horaFraccional(act.fin_programado) - horaFraccional(act.inicio_programado)) * ALTURA_HORA)
                      return (
                        <ActividadBloque
                          key={act.id}
                          actividad={act}
                          frentes={frentes}
                          top={Math.round(top)}
                          height={Math.round(alto)}
                          leftPct={(lane.carril / lane.carriles) * 100}
                          widthPct={(1 / lane.carriles) * 100}
                          onSelect={setSeleccionada}
                          onResize={redimensionar}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Mobile: un día a la vez dentro de la semana */}
          <div className="flex flex-col gap-4 md:hidden">
            <div className="flex gap-1.5">
              {dias.map((dia, i) => {
                const { dow, num } = diaLabel(dia)
                const activo = i === diaMovil
                const tieneActs = (porDia.get(dia) ?? []).length > 0
                return (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => setDiaMovil(i)}
                    className={cn("flex flex-1 flex-col items-center gap-1 rounded-xl border py-2", activo ? "border-foreground bg-foreground text-background" : dia === hoy ? "border-border bg-[var(--surface-sunken)]" : "border-border bg-card")}
                  >
                    <span className={cn("font-mono-compass text-[9px] tracking-[0.08em]", activo ? "text-background/70" : "text-muted-foreground")}>{dow}</span>
                    <span className="font-editorial text-base leading-none">{num}</span>
                    <span className={cn("size-1 rounded-full", tieneActs ? (activo ? "bg-background/80" : "bg-foreground/40") : "bg-transparent")} />
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col gap-2.5">
              {(porDia.get(dias[diaMovil]!) ?? []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center font-mono-compass text-[10.5px] tracking-[0.1em] text-muted-foreground uppercase">
                  Sin actividades
                </div>
              ) : (
                (porDia.get(dias[diaMovil]!) ?? []).map((act) => <ActividadMobileItem key={act.id} actividad={act} frentes={frentes} onSelect={setSeleccionada} />)
              )}
              <button
                type="button"
                onClick={() => abrirCrear(dias[diaMovil]!)}
                className="ml-14 h-11 rounded-2xl border border-dashed border-border text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                + Nueva actividad
              </button>
            </div>
          </div>
        </>
      )}

      {seleccionada && (
        <ActividadDetallePanel
          actividad={seleccionada}
          actividades={actividades}
          frentes={frentes}
          onClose={() => setSeleccionada(null)}
          onGestionar={abrirGestion}
          onEditar={() => abrirEdicion(seleccionada)}
          onEliminar={() => void confirmarEliminacion(seleccionada)}
        />
      )}

      <CerrarActividadDrawer
        actividad={gestion?.actividad ?? null}
        modoInicial={gestion?.modo ?? "cerrar"}
        open={!!gestion}
        onOpenChange={(v) => !v && setGestion(null)}
        onSaved={load}
      />

      {(creando || editando) && (
        <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/20 backdrop-blur-xs sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) { setCreando(null); setEditando(null) } }}>
          <div className="flex max-h-[88%] w-full max-w-lg flex-col gap-5 overflow-auto rounded-t-2xl border border-border bg-popover p-5 shadow-xl sm:rounded-2xl">
            <div className="flex flex-col gap-1">
              <span className="font-mono-compass text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">{editando ? "Editar actividad" : "Nueva actividad"}</span>
              <h2 className="font-editorial text-2xl leading-tight text-foreground">{editando ? "Ajusta la actividad" : "¿Qué vas a hacer?"}</h2>
            </div>

            <Field>
              <FieldLabel htmlFor="act-titulo">Título</FieldLabel>
              <Input id="act-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nombre de la actividad" autoFocus />
            </Field>

            <div className="flex gap-2.5">
              <Field className="flex-1">
                <FieldLabel htmlFor="act-dia">Día</FieldLabel>
                <select id="act-dia" value={diaForm} onChange={(e) => setDiaForm(Number(e.target.value))} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  {dias.map((dia, i) => { const { largo } = diaLabel(dia); return <option key={dia} value={i}>{largo}</option> })}
                </select>
              </Field>
              <Field className="w-28">
                <FieldLabel htmlFor="act-inicio">Inicio</FieldLabel>
                <Input id="act-inicio" type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />
              </Field>
              <Field className="w-28">
                <FieldLabel htmlFor="act-fin">Fin</FieldLabel>
                <Input id="act-fin" type="time" value={fin} onChange={(e) => setFin(e.target.value)} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="act-frente">Frente (opcional)</FieldLabel>
              <select id="act-frente" value={frenteId} onChange={(e) => { setFrenteId(e.target.value); setTareaId("") }} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="">Sin Frente</option>
                {frentes.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </select>
            </Field>

            <Field>
              <FieldLabel htmlFor="act-tarea">Tarea (opcional)</FieldLabel>
              <select id="act-tarea" value={tareaId} onChange={(e) => setTareaId(e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="">Sin Tarea</option>
                {tareas.filter((t) => (t.frente_id ?? null) === (frenteId ? Number(frenteId) : null)).map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
              </select>
            </Field>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => { setCreando(null); setEditando(null) }}>Cancelar</Button>
              <Button onClick={() => void (editando ? guardarEdicion() : guardarCreacion())} disabled={!titulo.trim() || fin <= inicio || loading}>{editando ? "Guardar cambios" : "Agendar"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
