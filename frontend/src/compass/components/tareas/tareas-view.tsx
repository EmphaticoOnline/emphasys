"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useRealWork } from "@/lib/real-work-store"
import { colorVarDeFrente } from "@/lib/frente-color"
import { cn } from "@/lib/utils"
import type { Frente, IntencionPrioridad, Tarea, TareaCreate, TareaEstado } from "../../../services/compassService"

const filtros = ["Pendientes", "Todas"] as const
type Filtro = (typeof filtros)[number]

const PRIORIDAD_PESO: Record<IntencionPrioridad, number> = { alta: 0, media: 1, baja: 2 }
const PRIORIDAD_NIVEL: Record<IntencionPrioridad, number> = { alta: 3, media: 2, baja: 1 }
const PRIORIDAD_LABEL: Record<IntencionPrioridad, string> = { alta: "Alta", media: "Media", baja: "Baja" }
const PRIORIDADES: IntencionPrioridad[] = ["alta", "media", "baja"]

function esAbierta(estado: TareaEstado) {
  return estado === "pendiente" || estado === "en_curso"
}
function esCerrada(estado: TareaEstado) {
  return estado === "completada" || estado === "cancelada"
}

/** Fecha-calendario (YYYY-MM-DD) sin conversión de zona horaria — mismo patrón que real-frentes.tsx (formatSoloFechaCorta). */
function parseFechaLimite(ymd: string) {
  return new Date(`${ymd}T12:00:00`)
}
function formatFechaCortaLocal(ymd: string) {
  return parseFechaLimite(ymd).toLocaleDateString("es-MX", { day: "numeric", month: "short" })
}
function diasHasta(ymd: string) {
  const hoy = new Date()
  hoy.setHours(12, 0, 0, 0)
  return Math.round((parseFechaLimite(ymd).getTime() - hoy.getTime()) / 86400000)
}

type UrgenciaTono = "vencida" | "hoy" | "pronto" | "normal" | "ninguna"

function urgenciaFecha(fechaLimite: string | null): { label: string; tono: UrgenciaTono } {
  if (!fechaLimite) return { label: "Sin fecha", tono: "ninguna" }
  const dias = diasHasta(fechaLimite)
  const corta = formatFechaCortaLocal(fechaLimite)
  if (dias < 0) return { label: `Vencida · ${Math.abs(dias)} d`, tono: "vencida" }
  if (dias === 0) return { label: "Vence hoy", tono: "hoy" }
  if (dias <= 3) return { label: `En ${dias} d · ${corta}`, tono: "pronto" }
  return { label: corta, tono: "normal" }
}

const urgenciaClases: Record<UrgenciaTono, string> = {
  vencida: "bg-foreground text-background font-semibold",
  hoy: "font-semibold",
  pronto: "border border-border text-muted-foreground",
  normal: "text-muted-foreground",
  ninguna: "border border-dashed border-border text-muted-foreground/70",
}

function FechaBadge({ fechaLimite }: { fechaLimite: string | null }) {
  const { label, tono } = urgenciaFecha(fechaLimite)
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-2 py-0.5 font-mono-compass text-[10px] tracking-[0.06em] whitespace-nowrap uppercase",
        urgenciaClases[tono],
      )}
      style={tono === "hoy" ? { background: "color-mix(in oklch, var(--accent), transparent 78%)", color: "var(--accent-foreground)" } : undefined}
    >
      {label}
    </span>
  )
}

function PrioridadIndicador({ prioridad }: { prioridad: IntencionPrioridad | null }) {
  const nivel = prioridad ? PRIORIDAD_NIVEL[prioridad] : 0
  return (
    <span className="flex items-center gap-1.5" title={prioridad ? `Prioridad ${PRIORIDAD_LABEL[prioridad]}` : "Sin prioridad"}>
      <span className="flex items-end gap-[3px]">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={cn("w-[3.5px] rounded-full", bar <= nivel ? "bg-foreground/70" : "bg-border")}
            style={{ height: `${5 + bar * 3}px` }}
          />
        ))}
      </span>
      <span className="font-mono-compass text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
        {prioridad ? PRIORIDAD_LABEL[prioridad] : "Sin prioridad"}
      </span>
    </span>
  )
}

function FrenteTag({ frentes, frenteId, frenteNombre }: { frentes: Frente[]; frenteId: number | null; frenteNombre: string | null }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="size-2 shrink-0 rounded-sm" style={{ background: colorVarDeFrente(frentes, frenteId) }} aria-hidden />
      <span className="truncate text-[13px] text-muted-foreground">{frenteNombre ?? "Sin Frente"}</span>
    </span>
  )
}

function TareaRow({ tarea, frentes, destacada, onToggle }: { tarea: Tarea; frentes: Frente[]; destacada: boolean; onToggle: (t: Tarea) => void }) {
  const cerrada = esCerrada(tarea.estado)
  const cancelada = tarea.estado === "cancelada"
  const cierreLabel = tarea.fecha_finalizacion
    ? `${cancelada ? "Cancelada" : "Completada"} · ${formatFechaCortaLocal(tarea.fecha_finalizacion)}`
    : cancelada ? "Cancelada" : "Completada"

  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3.5 transition-colors sm:items-center",
        cerrada
          ? "border-border bg-[var(--surface-sunken)]"
          : destacada
            ? "border-border border-l-4 bg-card shadow-[0_1px_0_rgba(0,0,0,0.02)]"
            : "border-border bg-card hover:bg-accent/10",
      )}
      style={destacada && !cerrada ? { borderLeftColor: "var(--primary)" } : undefined}
    >
      <input
        type="checkbox"
        checked={cerrada}
        onChange={() => onToggle(tarea)}
        aria-label={cerrada ? "Reabrir tarea" : "Completar tarea"}
        className="mt-1 size-4 shrink-0 sm:mt-0"
        style={{ accentColor: "var(--primary)" }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span
          className={cn(
            destacada && !cerrada ? "text-[17px] font-semibold" : "text-sm font-medium",
            "text-pretty leading-snug",
            cerrada ? "text-muted-foreground" : "text-foreground",
            cancelada && "line-through",
          )}
        >
          {tarea.titulo}
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <FrenteTag frentes={frentes} frenteId={tarea.frente_id} frenteNombre={tarea.frente_nombre} />
          {cerrada ? (
            <span className="font-mono-compass text-[10px] tracking-[0.08em] text-muted-foreground uppercase">{cierreLabel}</span>
          ) : (
            <>
              <PrioridadIndicador prioridad={tarea.prioridad_operativa} />
              <FechaBadge fechaLimite={tarea.fecha_limite} />
            </>
          )}
        </div>
      </div>
    </label>
  )
}

function NuevaTarea({ open, close, frentes, crear }: { open: boolean; close: () => void; frentes: Frente[]; crear: (payload: TareaCreate) => Promise<unknown> }) {
  const [titulo, setTitulo] = useState("")
  const [frenteId, setFrenteId] = useState("")
  const [fecha, setFecha] = useState("")
  const [prioridad, setPrioridad] = useState<IntencionPrioridad | "">("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  if (!open) return null

  const reset = () => { setTitulo(""); setFrenteId(""); setFecha(""); setPrioridad(""); setError("") }
  const cancelar = () => { reset(); close() }
  const guardar = async () => {
    if (!titulo.trim()) return
    try {
      setSaving(true); setError("")
      await crear({ titulo: titulo.trim(), frente_id: frenteId ? Number(frenteId) : null, fecha_limite: fecha || null, prioridad_operativa: prioridad || null, es_siguiente_accion: false })
      reset(); close()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear la tarea")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/20 backdrop-blur-xs sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && cancelar()}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="nueva-tarea-title" className="flex max-h-[88%] w-full max-w-lg flex-col gap-5 overflow-auto rounded-t-2xl border border-border bg-popover p-5 shadow-xl sm:rounded-2xl">
        <div className="flex flex-col gap-1">
          <span className="font-mono-compass text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">Nueva tarea</span>
          <h2 id="nueva-tarea-title" className="font-editorial text-2xl leading-tight text-foreground">¿Qué sigue?</h2>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Field>
          <FieldLabel htmlFor="tarea-titulo">Título</FieldLabel>
          <Input id="tarea-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Escribe la tarea" autoFocus />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="tarea-frente">Frente (opcional)</FieldLabel>
            <select id="tarea-frente" value={frenteId} onChange={(e) => setFrenteId(e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
              <option value="">Sin Frente</option>
              {frentes.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="tarea-fecha">Fecha límite (opcional)</FieldLabel>
            <Input id="tarea-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
        </div>

        <Field>
          <FieldLabel>Prioridad (opcional)</FieldLabel>
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setPrioridad("")}
              className={cn("h-9 rounded-lg border text-xs font-semibold", prioridad === "" ? "border-transparent bg-primary text-primary-foreground" : "border-input bg-transparent text-foreground")}
            >
              Ninguna
            </button>
            {PRIORIDADES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrioridad(p)}
                className={cn("h-9 rounded-lg border text-xs font-semibold", prioridad === p ? "border-transparent bg-primary text-primary-foreground" : "border-input bg-transparent text-foreground")}
              >
                {PRIORIDAD_LABEL[p]}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={cancelar} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void guardar()} disabled={saving || !titulo.trim()}>Crear tarea</Button>
        </div>
      </div>
    </div>
  )
}

export function TareasView() {
  const { tareas, frentes, loading, error, loadTareas, loadFrentes, crearTarea, actualizarTarea } = useRealWork()
  const [filtro, setFiltro] = useState<Filtro>("Pendientes")
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => { await Promise.all([loadFrentes(), loadTareas({})]) }, [loadFrentes, loadTareas])
  useEffect(() => { void load() }, [load])

  const ordenar = useCallback((lista: Tarea[]) => [...lista].sort((a, b) => {
    const pa = a.prioridad_operativa ? PRIORIDAD_PESO[a.prioridad_operativa] : 3
    const pb = b.prioridad_operativa ? PRIORIDAD_PESO[b.prioridad_operativa] : 3
    if (pa !== pb) return pa - pb
    return (a.fecha_limite ?? "9999").localeCompare(b.fecha_limite ?? "9999")
  }), [])

  const abiertas = useMemo(() => ordenar(tareas.filter((t) => esAbierta(t.estado))), [tareas, ordenar])
  const cerradas = useMemo(() => tareas.filter((t) => esCerrada(t.estado)), [tareas])
  const siguientes = useMemo(() => abiertas.filter((t) => t.es_siguiente_accion), [abiertas])
  const resto = useMemo(() => abiertas.filter((t) => !t.es_siguiente_accion), [abiertas])
  const vencidas = useMemo(() => abiertas.filter((t) => t.fecha_limite && diasHasta(t.fecha_limite) < 0).length, [abiertas])

  const mostrarCerradas = filtro === "Todas" && cerradas.length > 0
  const listaVacia = filtro === "Pendientes" ? abiertas.length === 0 : tareas.length === 0

  const toggle = async (t: Tarea) => {
    await actualizarTarea(t.id, { estado: esCerrada(t.estado) ? "pendiente" : "completada" })
    await loadTareas({})
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl bg-gradient-to-b from-[var(--surface-header)] to-[var(--surface-header-end)] px-5 py-4 md:px-8 md:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex max-w-lg flex-col gap-1">
            <span className="font-mono-compass text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Compass</span>
            <h1 className="font-editorial text-4xl leading-[0.95] tracking-tight text-foreground md:text-5xl">Tareas</h1>
            <p className="mt-0.5 text-sm text-pretty text-muted-foreground">
              Compromisos concretos. Cada tarea puede pertenecer a un Frente, o no — no todo necesita una dirección.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-2">
              <div className="flex flex-col gap-0.5 rounded-xl bg-[var(--surface-raised)] px-3.5 py-2">
                <span className="font-editorial text-2xl leading-none text-foreground">{abiertas.length}</span>
                <span className="font-mono-compass text-[10px] font-medium tracking-[0.08em] text-muted-foreground">ABIERTAS</span>
              </div>
              <div className="flex flex-col gap-0.5 rounded-xl bg-[var(--surface-raised)] px-3.5 py-2">
                <span className="font-editorial text-2xl leading-none text-foreground">{siguientes.length}</span>
                <span className="font-mono-compass text-[10px] font-medium tracking-[0.08em] text-muted-foreground">SIGUIENTE ACCIÓN</span>
              </div>
              <div className="flex flex-col gap-0.5 rounded-xl px-3.5 py-2" style={{ background: "color-mix(in oklch, var(--chart-1), transparent 88%)" }}>
                <span className="font-editorial text-2xl leading-none" style={{ color: "var(--chart-1)" }}>{vencidas}</span>
                <span className="font-mono-compass text-[10px] font-medium tracking-[0.08em]" style={{ color: "var(--chart-1)" }}>VENCIDAS</span>
              </div>
            </div>
            <Button onClick={() => setCreating(true)} className="min-h-11 md:min-h-8"><Plus />Nueva tarea</Button>
          </div>
        </div>
      </header>

      <div className="flex items-center gap-2" role="tablist" aria-label="Filtrar Tareas">
        {filtros.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filtro === f}
            onClick={() => setFiltro(f)}
            className={cn(
              "min-h-9 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors md:min-h-0",
              filtro === f ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
            <span className="ml-1.5 font-mono-compass text-[10px] opacity-65">{f === "Pendientes" ? abiertas.length : tareas.length}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-card px-5 py-5">
          <p className="font-editorial text-lg text-destructive">No pudimos cargar tus tareas</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => void load()}><RefreshCw />Reintentar</Button>
        </div>
      )}

      {!error && loading && tareas.length === 0 && (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-2xl border border-border bg-[var(--surface-sunken)]" />
          ))}
        </div>
      )}

      {!error && !(loading && tareas.length === 0) && listaVacia && (
        <Empty className="rounded-2xl bg-[var(--surface-sunken)] py-8">
          <EmptyHeader>
            <EmptyTitle className="font-editorial text-xl font-normal">
              {filtro === "Pendientes" ? "Nada pendiente." : "Aún no hay tareas."}
            </EmptyTitle>
            <EmptyDescription>
              {filtro === "Pendientes"
                ? "Cuando definas la siguiente acción de un Frente, aparecerá aquí."
                : "Crea la primera tarea para empezar a decidir qué sigue."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setCreating(true)}><Plus />Nueva tarea</Button>
          </EmptyContent>
        </Empty>
      )}

      {!error && !listaVacia && (
        <div className="flex flex-col gap-7">
          {siguientes.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <h2 className="font-mono-compass text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">Siguiente acción</h2>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex flex-col gap-2">
                {siguientes.map((t) => <TareaRow key={t.id} tarea={t} frentes={frentes} destacada onToggle={(item) => void toggle(item)} />)}
              </div>
            </section>
          )}

          {resto.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <h2 className="font-mono-compass text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Abiertas</h2>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex flex-col gap-2">
                {resto.map((t) => <TareaRow key={t.id} tarea={t} frentes={frentes} destacada={false} onToggle={(item) => void toggle(item)} />)}
              </div>
            </section>
          )}

          {mostrarCerradas && (
            <section className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <h2 className="font-mono-compass text-[11px] font-semibold tracking-[0.14em] text-muted-foreground/70 uppercase">Cerradas</h2>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex flex-col gap-2">
                {cerradas.map((t) => <TareaRow key={t.id} tarea={t} frentes={frentes} destacada={false} onToggle={(item) => void toggle(item)} />)}
              </div>
            </section>
          )}
        </div>
      )}

      <NuevaTarea open={creating} close={() => setCreating(false)} frentes={frentes} crear={async (payload) => { const t = await crearTarea(payload); await loadTareas({}); return t }} />
    </div>
  )
}
