import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, Lightbulb, Pencil, Plus, RefreshCw, Scale } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { colorVarDeFrente } from "@/lib/frente-color"
import { formatDuracionMin, formatFechaCorta, formatHora, formatHorasCompacto, horasEntre } from "@/lib/format"
import {
  createFrente, getFrente, listFrentes, saveIntencionSemanal, updateFrente,
  type ActividadEstado, type Congruencia, type Decision, type ExpectativaAtencion, type Frente,
  type FrenteCategoria, type FrenteEstado, type Idea, type IntencionPrioridad, type RevisionFrente, type TareaEstado,
  listActividades, listDecisiones, listIdeas, listTareas, getRevisionSemanal, updateTarea,
  type Actividad, type Tarea,
} from "../../../services/compassService"

const allStates: FrenteEstado[] = ["activo", "pausado", "completado", "archivado"]

const notaEstado: Record<"pausado" | "completado" | "archivado", string> = {
  pausado: "Sigue existiendo como dirección; no compite por atención esta semana.",
  completado: "Cerrado. Se conserva para la revisión semanal.",
  archivado: "Fuera del mapa activo; visible solo al filtrar.",
}

const congruenciaLabel: Record<Congruencia, string> = {
  congruente: "Congruente",
  en_riesgo: "En riesgo",
  descuidado: "Descuidado",
  sobreatendido: "Sobreatendido",
}

const congruenciaColorVar: Record<Congruencia, string> = {
  congruente: "var(--congruent)",
  en_riesgo: "var(--at-risk)",
  descuidado: "var(--neglected)",
  sobreatendido: "var(--overattended)",
}

const actividadEstadoColorVar: Record<ActividadEstado, string> = {
  programada: "var(--muted-foreground)",
  realizada: "var(--congruent)",
  parcial: "var(--at-risk)",
  no_realizada: "var(--overattended)",
  cancelada: "var(--neglected)",
}

function monday(): string {
  const now = new Date()
  const day = now.getDay() || 7
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function pretty(value: string | null | undefined) {
  if (!value) return "Sin definir"
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())
}

function objetivoLabel(frente: Frente) {
  if (frente.horas_objetivo != null) return `${frente.horas_objetivo} h`
  if (frente.expectativa_atencion != null) return pretty(frente.expectativa_atencion)
  return "Sin definir"
}

/** Formatea una fecha-calendario (YYYY-MM-DD, sin hora) sin pasar por conversión de zona horaria. */
function formatSoloFechaCorta(ymd: string) {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" })
}

function tareaMeta(t: Tarea) {
  const partes = [t.fecha_limite ? formatSoloFechaCorta(t.fecha_limite).toUpperCase() : "SIN FECHA"]
  if (t.prioridad_operativa) partes.push(t.prioridad_operativa.toUpperCase())
  return partes.join(" · ")
}

function Status({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (loading) return <div className="rounded-2xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">Cargando Frentes…</div>
  if (!error) return null
  return (
    <div className="rounded-2xl border border-destructive/30 bg-card px-5 py-5">
      <p className="font-editorial text-lg text-destructive">{error}</p>
      <Button variant="outline" className="mt-3" onClick={retry}><RefreshCw />Reintentar</Button>
    </div>
  )
}

function FrenteCard({ frente, color }: { frente: Frente; color: string }) {
  if (frente.estado !== "activo") {
    const estado = frente.estado as "pausado" | "completado" | "archivado"
    return (
      <Link
        to={`/compass/frentes/${frente.id}`}
        className="flex flex-col gap-2 rounded-2xl border border-dashed border-border bg-card px-4 py-3.5 transition-colors hover:border-primary/30"
      >
        <Badge variant="secondary" className="self-start font-mono-compass text-[9.5px] font-semibold tracking-[0.08em] uppercase">
          {pretty(frente.estado)}
        </Badge>
        <span className="font-editorial text-lg leading-tight text-foreground/80 text-pretty">{frente.nombre}</span>
        <span className="text-[11.5px] leading-relaxed text-muted-foreground text-pretty">{notaEstado[estado]}</span>
      </Link>
    )
  }

  const prioridad = frente.prioridad_semanal
  const barWidth = prioridad === "alta" ? 5 : prioridad === "media" ? 3 : 2
  const tieneIntencion = frente.intencion_semanal != null
  const tieneAccion = frente.siguiente_accion != null

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/30 hover:shadow-sm"
      style={prioridad === "alta" ? { background: `color-mix(in oklch, ${color}, var(--card) 94%)` } : undefined}
    >
      <span
        className="absolute inset-y-0 left-0"
        style={{ width: `${barWidth}px`, background: prioridad === "baja" ? `color-mix(in oklch, ${color}, transparent 55%)` : color }}
        aria-hidden
      />
      <div className="flex flex-col gap-3.5 py-4 pr-4.5 pl-5">
        <Link to={`/compass/frentes/${frente.id}`} className="flex flex-col gap-1.5 rounded-lg">
          <span className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
            <span className="font-mono-compass text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
              {pretty(frente.categoria)} · {pretty(frente.estado)}
            </span>
          </span>
          <span className="font-editorial text-xl leading-tight text-foreground text-pretty group-hover:text-primary">{frente.nombre}</span>
          <span className="text-[13px] leading-relaxed text-muted-foreground text-pretty">{frente.proposito}</span>
        </Link>

        <div className="flex flex-col gap-2 rounded-xl bg-[var(--surface-sunken)] px-3.5 py-3">
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="font-mono-compass text-[10px] font-semibold tracking-[0.1em] text-muted-foreground">PRIORIDAD</span>
            <span className="font-editorial text-base text-foreground">{prioridad ? pretty(prioridad) : "Sin definir"}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="font-mono-compass text-[10px] font-semibold tracking-[0.1em] text-muted-foreground">OBJETIVO</span>
            <span className="font-editorial text-base text-foreground">{objetivoLabel(frente)}</span>
          </div>
          {!tieneIntencion && (
            <Link
              to={`/compass/frentes/${frente.id}`}
              className="self-start border-b border-primary/40 pb-px text-[11px] font-semibold text-primary hover:border-primary"
            >
              Definir intención de la semana
            </Link>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-mono-compass text-[10px] font-semibold tracking-[0.1em] text-muted-foreground">SIGUIENTE ACCIÓN</span>
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="text-sm text-muted-foreground">{frente.siguiente_accion?.titulo ?? "Sin definir"}</span>
            {!tieneAccion && (
              <Link
                to={`/compass/frentes/${frente.id}`}
                className="shrink-0 border-b border-primary/40 pb-px text-[11px] font-semibold text-primary hover:border-primary"
              >
                Elegir tarea
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function NewFrente({ open, close, saved }: { open: boolean; close: () => void; saved: (frente: Frente) => void }) {
  const [nombre, setNombre] = useState("")
  const [proposito, setProposito] = useState("")
  const [categoria, setCategoria] = useState<FrenteCategoria>("profesional")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  if (!open) return null
  const submit = async () => {
    try { setSaving(true); setError(""); const result = await createFrente({ nombre, proposito, categoria }); saved(result) }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo crear el Frente") }
    finally { setSaving(false) }
  }
  return <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/20 p-0 backdrop-blur-xs sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <div role="dialog" aria-modal="true" aria-labelledby="new-frente-title" className="w-full max-w-lg rounded-t-2xl border border-border bg-popover p-5 shadow-xl sm:rounded-2xl">
      <h2 id="new-frente-title" className="font-heading text-xl text-foreground">Nuevo Frente</h2><p className="mt-1 text-sm text-muted-foreground">Una dirección sostenida, no una tarea.</p>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-5 flex flex-col gap-4"><Field><FieldLabel htmlFor="frente-nombre">Nombre</FieldLabel><Input id="frente-nombre" maxLength={200} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus /></Field><Field><FieldLabel htmlFor="frente-proposito">Propósito</FieldLabel><Textarea id="frente-proposito" value={proposito} onChange={(e) => setProposito(e.target.value)} className="min-h-24 resize-none" /></Field><Field><FieldLabel htmlFor="frente-categoria">Categoría</FieldLabel><select id="frente-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as FrenteCategoria)} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"><option value="profesional">Profesional</option><option value="personal">Personal</option></select></Field></div>
      <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={close} disabled={saving}>Cancelar</Button><Button onClick={submit} disabled={saving || !nombre.trim() || !proposito.trim()}>Crear Frente</Button></div>
    </div>
  </div>
}

export function RealFrentesView() {
  const navigate = useNavigate()
  const [frentes, setFrentes] = useState<Frente[]>([])
  const [filter, setFilter] = useState<"todos" | FrenteCategoria>("todos")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)
  const load = useCallback(async () => { try { setLoading(true); setError(""); setFrentes(await listFrentes(allStates)) } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron cargar los Frentes") } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])

  const visible = useMemo(() => frentes.filter((item) => filter === "todos" || item.categoria === filter), [filter, frentes])
  const activos = visible.filter((item) => item.estado === "activo")
  const otros = visible.filter((item) => item.estado !== "activo")

  const todosActivos = useMemo(() => frentes.filter((f) => f.estado === "activo"), [frentes])
  const nConIntencion = useMemo(() => todosActivos.filter((f) => f.intencion_semanal != null).length, [todosActivos])
  const nActivos = todosActivos.length
  const nSinDefinir = nActivos - nConIntencion

  const semanaLabel = useMemo(
    () => `Semana del ${new Date(`${monday()}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}`,
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl bg-gradient-to-b from-[var(--surface-header)] to-[var(--surface-header-end)] px-5 py-4 md:px-8 md:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex max-w-lg flex-col gap-1">
            <span className="font-mono-compass text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Mapa de atención · {semanaLabel}
            </span>
            <h1 className="font-editorial text-4xl leading-[0.95] tracking-tight text-foreground md:text-5xl">Frentes</h1>
            <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
              Los frentes son las áreas de tu vida a las que decidiste prestar atención. No son tareas — son direcciones.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-2">
              <div className="flex flex-col gap-0.5 rounded-xl bg-[var(--surface-raised)] px-3.5 py-2">
                <span className="font-editorial text-2xl leading-none text-foreground">{nActivos}</span>
                <span className="font-mono-compass text-[10px] font-medium tracking-[0.08em] text-muted-foreground">ACTIVOS</span>
              </div>
              <div className="flex flex-col gap-0.5 rounded-xl bg-[var(--surface-raised)] px-3.5 py-2">
                <span className="font-editorial text-2xl leading-none text-foreground">{nConIntencion}</span>
                <span className="font-mono-compass text-[10px] font-medium tracking-[0.08em] text-muted-foreground">CON INTENCIÓN</span>
              </div>
              <div className="flex flex-col gap-0.5 rounded-xl px-3.5 py-2" style={{ background: "color-mix(in oklch, var(--chart-1), transparent 88%)" }}>
                <span className="font-editorial text-2xl leading-none" style={{ color: "var(--chart-1)" }}>{nSinDefinir}</span>
                <span className="font-mono-compass text-[10px] font-medium tracking-[0.08em]" style={{ color: "var(--chart-1)" }}>SIN DEFINIR</span>
              </div>
            </div>
            <Button onClick={() => setCreating(true)} className="min-h-11 md:min-h-8"><Plus />Nuevo</Button>
          </div>
        </div>
      </header>

      <div className="flex items-center gap-2" role="tablist" aria-label="Filtrar Frentes por categoría">
        {([["todos", "Todos"], ["profesional", "Profesional"], ["personal", "Personal"]] as const).map(([value, text]) => (
          <button
            key={value}
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={`min-h-9 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors md:min-h-0 ${filter === value ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
          >
            {text}
          </button>
        ))}
      </div>

      <Status loading={loading} error={error} retry={() => void load()} />

      {!loading && !error && visible.length === 0 && (
        <Empty className="rounded-2xl bg-[var(--surface-sunken)] py-8">
          <EmptyHeader>
            <EmptyTitle className="font-editorial text-xl font-normal">Aún no hay Frentes.</EmptyTitle>
            <EmptyDescription>Crea el primero para definir su intención semanal.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setCreating(true)}><Plus />Crear Frente</Button>
          </EmptyContent>
        </Empty>
      )}

      {activos.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2.5">
            <h2 className="font-editorial text-xl leading-none text-foreground">Dónde está puesta la atención</h2>
            <span className="font-mono-compass text-[11px] font-medium tracking-[0.08em] text-muted-foreground">{activos.length} ACTIVOS</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(264px,1fr))] gap-3.5">
            {activos.map((item) => (
              <FrenteCard key={item.id} frente={item} color={colorVarDeFrente(frentes, item.id)} />
            ))}
          </div>
        </section>
      )}

      {otros.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl bg-[var(--surface-sunken)] p-4">
          <div className="flex items-center gap-2">
            <h2 className="font-editorial text-lg leading-none text-foreground">Fuera del foco de esta semana</h2>
            <Badge variant="secondary">{otros.length}</Badge>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
            {otros.map((item) => (
              <FrenteCard key={item.id} frente={item} color={colorVarDeFrente(frentes, item.id)} />
            ))}
          </div>
        </section>
      )}

      <NewFrente open={creating} close={() => setCreating(false)} saved={(frente) => { setCreating(false); navigate(`/compass/frentes/${frente.id}`) }} />
    </div>
  )
}

const gruposTarea: { key: TareaEstado; label: string }[] = [
  { key: "en_curso", label: "EN CURSO" },
  { key: "pendiente", label: "PENDIENTES" },
  { key: "completada", label: "COMPLETADAS ESTA SEMANA" },
  { key: "cancelada", label: "CANCELADAS" },
]

export function RealFrenteDetailView() {
  const params = useParams()
  const id = Number(params.id)
  const [frente, setFrente] = useState<Frente | null>(null)
  const [frentesOrden, setFrentesOrden] = useState<Frente[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [editingFrente, setEditingFrente] = useState(false)
  const [editingIntencion, setEditingIntencion] = useState(false)
  const [nombre, setNombre] = useState("")
  const [proposito, setProposito] = useState("")
  const [categoria, setCategoria] = useState<FrenteCategoria>("profesional")
  const [estado, setEstado] = useState<FrenteEstado>("activo")
  const [prioridad, setPrioridad] = useState<IntencionPrioridad>("media")
  const [mode, setMode] = useState<"horas" | "expectativa">("horas")
  const [horas, setHoras] = useState("")
  const [expectativa, setExpectativa] = useState<ExpectativaAtencion>("atender")
  const [comentario, setComentario] = useState("")
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [decisiones, setDecisiones] = useState<Decision[]>([])
  const [revisionFrente, setRevisionFrente] = useState<RevisionFrente | null>(null)

  const loadTrabajo = useCallback(async () => {
    if (!Number.isInteger(id)) return
    const [nextTareas, nextActividades] = await Promise.all([listTareas({ frente_id: id }), listActividades({ frente_id: id })])
    setTareas(nextTareas); setActividades(nextActividades.slice(-8).reverse())
  }, [id])

  const loadContexto = useCallback(async () => {
    if (!Number.isInteger(id)) return
    try {
      const [todasIdeas, todasDecisiones, revision, ordenFrentes] = await Promise.all([
        listIdeas("activa"), listDecisiones(), getRevisionSemanal(monday()), listFrentes(allStates),
      ])
      setIdeas(todasIdeas.filter((i) => i.frente_id === id))
      setDecisiones(todasDecisiones.filter((d) => d.frente_id === id))
      setRevisionFrente(revision.frentes.find((f) => f.frente_id === id) ?? null)
      setFrentesOrden(ordenFrentes)
    } catch {
      // Contexto secundario: si falla, el resto de la pantalla sigue siendo útil.
    }
  }, [id])

  const load = useCallback(async () => {
    try { setLoading(true); setError(""); const data = await getFrente(id); setFrente(data); setNombre(data.nombre); setProposito(data.proposito); setCategoria(data.categoria); setEstado(data.estado); if (data.intencion_semanal) { setPrioridad(data.intencion_semanal.prioridad); setComentario(data.intencion_semanal.comentario ?? ""); if (data.intencion_semanal.horas_objetivo != null) { setMode("horas"); setHoras(String(data.intencion_semanal.horas_objetivo)) } else { setMode("expectativa"); setExpectativa(data.intencion_semanal.expectativa_atencion ?? "atender") } } }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar el Frente") }
    finally { setLoading(false) }
  }, [id])
  useEffect(() => { void load() }, [load])
  useEffect(() => { void loadTrabajo() }, [loadTrabajo])
  useEffect(() => { void loadContexto() }, [loadContexto])

  const saveFrente = async () => { try { setSaving(true); setError(""); const data = await updateFrente(id, { nombre, proposito, categoria, estado }); setFrente(data); setEditingFrente(false) } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar el Frente") } finally { setSaving(false) } }
  const saveIntent = async () => { try { setSaving(true); setError(""); await saveIntencionSemanal(id, { semana_inicio: monday(), prioridad, horas_objetivo: mode === "horas" ? Number(horas) : null, expectativa_atencion: mode === "expectativa" ? expectativa : null, comentario: comentario.trim() || null }); setEditingIntencion(false); await Promise.all([load(), loadContexto()]) } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar la intención") } finally { setSaving(false) } }

  const siguienteTarea = tareas.find((t) => t.es_siguiente_accion) ?? null
  const tareasElegibles = useMemo(() => tareas.filter((t) => !t.es_siguiente_accion && (t.estado === "pendiente" || t.estado === "en_curso")), [tareas])
  const cambiarSiguienteAccion = async (nextId: number) => {
    try {
      setSaving(true); setError("")
      const current = tareas.find((t) => t.es_siguiente_accion)
      if (current && current.id !== nextId) await updateTarea(current.id, { es_siguiente_accion: false })
      await updateTarea(nextId, { es_siguiente_accion: true })
      await loadTrabajo()
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar la siguiente acción") }
    finally { setSaving(false) }
  }
  const marcarSiguienteHecha = async () => {
    if (!siguienteTarea) return
    try { setSaving(true); setError(""); await updateTarea(siguienteTarea.id, { estado: "completada", es_siguiente_accion: false }); await loadTrabajo() }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar la tarea") }
    finally { setSaving(false) }
  }
  const toggleTareaHecha = async (t: Tarea) => {
    try { setSaving(true); setError(""); await updateTarea(t.id, { estado: t.estado === "completada" ? "pendiente" : "completada" }); await loadTrabajo() }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar la tarea") }
    finally { setSaving(false) }
  }

  if (loading) return <Status loading error="" retry={() => void load()} />
  if (!frente) return <div className="flex flex-col gap-4"><p className="text-sm text-destructive">{error || "No se encontró este Frente."}</p><Link to="/compass/frentes" className="text-sm underline">Volver a Frentes</Link></div>

  const color = colorVarDeFrente(frentesOrden.length ? frentesOrden : [frente], frente.id)
  const objetivoActual = frente.horas_objetivo ?? revisionFrente?.horas_objetivo_snapshot ?? null
  const horasEfectivas = revisionFrente?.horas_efectivas ?? null
  const progresoPct = objetivoActual != null && objetivoActual > 0 && horasEfectivas != null ? Math.min(100, Math.round((horasEfectivas / objetivoActual) * 100)) : null
  const congruencia = revisionFrente?.congruencia_sugerida ?? null
  const abiertas = tareas.filter((t) => t.estado === "pendiente" || t.estado === "en_curso").length
  const cerradas = tareas.length - abiertas

  return <div className="flex flex-col gap-8">
    <Link to="/compass/frentes" className="inline-flex items-center gap-1.5 font-mono-compass text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase hover:text-foreground"><ArrowLeft className="size-3.5" />Frentes</Link>
    {error && <p className="rounded-xl border border-destructive/30 bg-card px-4 py-3 text-sm text-destructive">{error}</p>}

    <header className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[var(--surface-header)] to-[var(--surface-header-end)] px-6 py-6 md:px-8 md:py-7">
      <span className="absolute inset-y-0 left-0 w-[5px]" style={{ background: color }} aria-hidden />
      <div className="flex flex-col gap-5 pl-3 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        <div className="flex max-w-2xl flex-col gap-2">
          <span className="flex items-center gap-2 font-mono-compass text-[10.5px] font-medium tracking-[0.11em] text-muted-foreground uppercase">
            <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />
            {pretty(frente.categoria)} · {pretty(frente.estado)}
          </span>
          <h1 className="font-editorial text-4xl leading-[0.98] tracking-tight text-foreground text-pretty md:text-5xl">{frente.nombre}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty md:text-[15px]">{frente.proposito}</p>
        </div>
        <div className="flex flex-col items-start gap-3.5 lg:items-end">
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-col gap-0.5 rounded-xl px-3.5 py-2" style={{ background: `color-mix(in oklch, ${color}, transparent 88%)` }}>
              <span className="font-editorial text-2xl leading-none" style={{ color }}>{frente.prioridad_semanal ? pretty(frente.prioridad_semanal) : "—"}</span>
              <span className="font-mono-compass text-[10px] font-medium tracking-[0.08em]" style={{ color }}>PRIORIDAD</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl bg-[var(--surface-raised)] px-3.5 py-2">
              <span className="font-editorial text-2xl leading-none text-foreground">{objetivoLabel(frente)}</span>
              <span className="font-mono-compass text-[10px] font-medium tracking-[0.08em] text-muted-foreground">{frente.horas_objetivo != null ? "OBJETIVO" : "EXPECTATIVA"}</span>
            </div>
            {horasEfectivas != null && (
              <div className="flex flex-col gap-0.5 rounded-xl bg-[var(--surface-raised)] px-3.5 py-2">
                <span className="font-editorial text-2xl leading-none text-foreground">{formatHorasCompacto(horasEfectivas)}</span>
                <span className="font-mono-compass text-[10px] font-medium tracking-[0.08em] text-muted-foreground">EFECTIVAS</span>
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditingFrente((v) => !v)}><Pencil />Editar Frente</Button>
        </div>
      </div>

      {editingFrente && (
        <div className="mt-6 grid gap-4 border-t border-border pl-3 pt-5 sm:grid-cols-3">
          <Field className="sm:col-span-2"><FieldLabel>Nombre</FieldLabel><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
          <Field><FieldLabel>Categoría</FieldLabel><select value={categoria} onChange={(e) => setCategoria(e.target.value as FrenteCategoria)} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"><option value="profesional">Profesional</option><option value="personal">Personal</option></select></Field>
          <Field><FieldLabel>Estado</FieldLabel><select value={estado} onChange={(e) => setEstado(e.target.value as FrenteEstado)} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">{allStates.map((item) => <option value={item} key={item}>{pretty(item)}</option>)}</select></Field>
          <Field className="sm:col-span-3"><FieldLabel>Propósito</FieldLabel><Textarea value={proposito} onChange={(e) => setProposito(e.target.value)} className="min-h-20 resize-none" /></Field>
          <div className="flex gap-2 sm:col-span-3"><Button onClick={saveFrente} disabled={saving}>Guardar cambios</Button><Button variant="ghost" onClick={() => setEditingFrente(false)}>Cancelar</Button></div>
        </div>
      )}
    </header>

    <section className="grid overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-3.5 px-6 py-6">
        <div className="flex items-center justify-between gap-4">
          <span className="font-mono-compass text-[10.5px] font-semibold tracking-[0.1em] text-muted-foreground">INTENCIÓN DE ESTA SEMANA</span>
          <button onClick={() => setEditingIntencion((v) => !v)} className="border-b border-primary/40 pb-px text-[11.5px] font-semibold text-primary hover:border-primary">Ajustar intención</button>
        </div>

        {frente.intencion_semanal ? (
          <>
            {frente.intencion_semanal.comentario ? (
              <p className="max-w-xl font-editorial text-[22px] leading-snug tracking-tight text-foreground text-pretty md:text-[26px]">«{frente.intencion_semanal.comentario}»</p>
            ) : (
              <p className="text-sm text-muted-foreground">Sin comentario para esta intención.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full px-2.5 py-1 font-mono-compass text-[10.5px] font-medium tracking-[0.06em]" style={{ background: `color-mix(in oklch, ${color}, transparent 88%)`, color }}>
                PRIORIDAD {frente.intencion_semanal.prioridad.toUpperCase()}
              </span>
              <span className="rounded-full bg-[var(--surface-sunken)] px-2.5 py-1 font-mono-compass text-[10.5px] font-medium tracking-[0.06em] text-muted-foreground">
                {frente.intencion_semanal.horas_objetivo != null ? `OBJETIVO ${frente.intencion_semanal.horas_objetivo} H` : `EXPECTATIVA ${pretty(frente.intencion_semanal.expectativa_atencion).toUpperCase()}`}
              </span>
              {frente.intencion_semanal.semana_inicio && (
                <span className="rounded-full bg-[var(--surface-sunken)] px-2.5 py-1 font-mono-compass text-[10.5px] font-medium tracking-[0.06em] text-muted-foreground">
                  DEFINIDA EL {formatSoloFechaCorta(frente.intencion_semanal.semana_inicio).toUpperCase()}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2.5 rounded-xl bg-[var(--surface-sunken)] px-4 py-3.5">
            <span className="font-editorial text-lg text-foreground">Aún no defines la intención de esta semana.</span>
            <Button size="sm" className="self-start" onClick={() => setEditingIntencion(true)}>Definir intención</Button>
          </div>
        )}

        {editingIntencion && (
          <div className="mt-1 grid grid-cols-1 gap-4 rounded-xl bg-[var(--surface-sunken)] p-4 sm:grid-cols-3">
            <Field><FieldLabel>Prioridad</FieldLabel><select value={prioridad} onChange={(e) => setPrioridad(e.target.value as IntencionPrioridad)} className="h-8 rounded-lg border border-input bg-[var(--card)] px-2.5 text-sm"><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></Field>
            <Field><FieldLabel>Tipo de objetivo</FieldLabel><select value={mode} onChange={(e) => setMode(e.target.value as "horas" | "expectativa")} className="h-8 rounded-lg border border-input bg-[var(--card)] px-2.5 text-sm"><option value="horas">Horas objetivo</option><option value="expectativa">Expectativa de atención</option></select></Field>
            {mode === "horas" ? <Field><FieldLabel>Horas objetivo</FieldLabel><Input type="number" min="0.01" max="9999.99" step="0.25" value={horas} onChange={(e) => setHoras(e.target.value)} /></Field> : <Field><FieldLabel>Expectativa</FieldLabel><select value={expectativa} onChange={(e) => setExpectativa(e.target.value as ExpectativaAtencion)} className="h-8 rounded-lg border border-input bg-[var(--card)] px-2.5 text-sm"><option value="sin_compromiso">Sin compromiso</option><option value="atender">Atender</option><option value="prioritario">Prioritario</option></select></Field>}
            <Field className="sm:col-span-3"><FieldLabel>Comentario opcional</FieldLabel><Textarea value={comentario} onChange={(e) => setComentario(e.target.value)} className="min-h-20 resize-none" /></Field>
            <div className="flex gap-2 sm:col-span-3">
              <Button onClick={saveIntent} disabled={saving || (mode === "horas" && !(Number(horas) > 0))}>{frente.intencion_semanal ? "Actualizar intención" : "Definir intención"}</Button>
              <Button variant="ghost" onClick={() => setEditingIntencion(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border bg-[var(--surface-sunken)] px-6 py-6 lg:border-t-0 lg:border-l">
        <span className="font-mono-compass text-[10.5px] font-semibold tracking-[0.1em] text-muted-foreground">ATENCIÓN REAL</span>
        {horasEfectivas != null ? (
          <div className="mt-3 flex flex-col gap-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="font-editorial text-4xl leading-none text-foreground">{formatHorasCompacto(horasEfectivas)}</span>
              {objetivoActual != null && <span className="font-mono-compass text-xs text-muted-foreground">/ {objetivoActual} h</span>}
            </div>
            {progresoPct != null && (
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full" style={{ width: `${progresoPct}%`, background: congruencia ? congruenciaColorVar[congruencia] : "var(--muted-foreground)" }} />
              </div>
            )}
            {congruencia && (
              <span className="font-mono-compass text-[10.5px] font-semibold tracking-[0.07em]" style={{ color: congruenciaColorVar[congruencia] }}>{congruenciaLabel[congruencia].toUpperCase()}</span>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground text-pretty">Horas reales de esta semana, sumadas de las actividades registradas para este Frente.</p>
          </div>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground text-pretty">Aún no hay actividades registradas esta semana para medir la atención real.</p>
        )}
      </div>
    </section>

    <section className="relative overflow-hidden rounded-2xl border px-6 py-5 md:px-7" style={{ background: `color-mix(in oklch, ${color}, var(--card) 92%)`, borderColor: `color-mix(in oklch, ${color}, transparent 78%)` }}>
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: color }} aria-hidden />
      {siguienteTarea ? (
        <div className="flex flex-col gap-4 pl-2 md:flex-row md:items-center md:justify-between md:gap-8">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-mono-compass text-[10.5px] font-semibold tracking-[0.1em]" style={{ color }}>SIGUIENTE ACCIÓN</span>
            <span className="font-editorial text-2xl leading-tight text-foreground text-pretty md:text-[28px]">{siguienteTarea.titulo}</span>
            <span className="text-xs text-muted-foreground">{tareaMeta(siguienteTarea)}</span>
          </div>
          <div className="flex flex-none flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => void marcarSiguienteHecha()} disabled={saving}>Marcar hecha</Button>
            {tareasElegibles.length > 0 && (
              <select defaultValue="" onChange={(e) => e.target.value && void cambiarSiguienteAccion(Number(e.target.value))} className="h-8 rounded-lg border border-input bg-[var(--card)] px-2.5 text-xs">
                <option value="" disabled>Cambiar…</option>
                {tareasElegibles.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
              </select>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pl-2 md:flex-row md:items-center md:justify-between md:gap-8">
          <span className="font-mono-compass text-[10.5px] font-semibold tracking-[0.1em] text-muted-foreground">SIGUIENTE ACCIÓN</span>
          <span className="font-editorial text-xl text-foreground md:mr-auto md:ml-4">Aún no eliges qué sigue.</span>
          {tareasElegibles.length > 0 ? (
            <select defaultValue="" onChange={(e) => e.target.value && void cambiarSiguienteAccion(Number(e.target.value))} className="h-9 rounded-lg border border-input bg-[var(--card)] px-3 text-sm">
              <option value="" disabled>Elegir una tarea…</option>
              {tareasElegibles.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
            </select>
          ) : (
            <span className="text-xs text-muted-foreground">No hay tareas pendientes para elegir.</span>
          )}
        </div>
      )}
    </section>

    <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="font-editorial text-2xl leading-none text-foreground">Tareas del Frente</h2>
            {tareas.length > 0 && <span className="font-mono-compass text-[11px] font-medium tracking-[0.06em] text-muted-foreground">{abiertas} ABIERTAS · {cerradas} CERRADAS</span>}
          </div>
          {tareas.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card px-5 py-6 text-sm text-muted-foreground">No hay tareas para este Frente.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {gruposTarea.map(({ key, label }) => {
                const items = tareas.filter((t) => t.estado === key)
                if (items.length === 0) return null
                return (
                  <div key={key}>
                    <div className="bg-[var(--surface-sunken)] px-5 py-2 font-mono-compass text-[10px] font-semibold tracking-[0.1em] text-muted-foreground">{label}</div>
                    {items.map((t) => (
                      <label key={t.id} className="flex cursor-pointer items-center gap-3 border-t border-border/70 px-5 py-3 hover:bg-accent/20">
                        <input type="checkbox" checked={t.estado === "completada"} onChange={() => void toggleTareaHecha(t)} className="size-4 shrink-0" style={{ accentColor: "var(--primary)" }} />
                        <span className={`flex-1 text-sm ${t.estado === "completada" ? "text-muted-foreground line-through" : "font-medium text-foreground"}`}>{t.titulo}</span>
                        <span className="shrink-0 font-mono-compass text-[10.5px] tracking-[0.05em] text-muted-foreground">{tareaMeta(t)}</span>
                      </label>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="font-editorial text-2xl leading-none text-foreground">Cómo se gastó el tiempo</h2>
            {actividades.length > 0 && <span className="font-mono-compass text-[11px] font-medium tracking-[0.06em] text-muted-foreground">ÚLTIMAS {actividades.length} ACTIVIDADES</span>}
          </div>
          {actividades.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card px-5 py-6 text-sm text-muted-foreground">No hay actividades registradas para este Frente.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {actividades.map((a) => (
                <div key={a.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-4 border-t border-border/70 px-5 py-3.5 first:border-t-0">
                  <span className="font-mono-compass text-[10.5px] leading-relaxed tracking-[0.04em] text-muted-foreground text-pretty">{formatFechaCorta(a.inicio_programado)}<br />{formatHora(a.inicio_programado)}</span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">{a.titulo}</span>
                    {a.resultado && <span className="font-editorial text-[13px] leading-snug text-muted-foreground italic text-pretty">{a.resultado}</span>}
                  </span>
                  <span className="flex flex-none items-center gap-2.5">
                    <span className="font-editorial text-base text-foreground">{a.minutos_efectivos != null ? formatDuracionMin(a.minutos_efectivos) : formatDuracionMin(Math.round(horasEntre(a.inicio_programado, a.fin_programado) * 60))}</span>
                    <span className="rounded-full px-2 py-1 font-mono-compass text-[9.5px] font-semibold tracking-[0.06em]" style={{ background: `color-mix(in oklch, ${actividadEstadoColorVar[a.estado]}, transparent 88%)`, color: actividadEstadoColorVar[a.estado] }}>
                      {a.estado.replaceAll("_", " ").toUpperCase()}
                    </span>
                  </span>
                </div>
              ))}
              <Link to="/compass/calendario" className="block px-5 py-3 text-[11.5px] font-semibold text-primary hover:underline">Ver todas en Calendario →</Link>
            </div>
          )}
        </section>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="rounded-2xl bg-[var(--surface-raised)] p-5">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="size-3.5 text-foreground/70" />
            <span className="font-mono-compass text-[10.5px] font-semibold tracking-[0.1em] text-foreground/80">IDEAS DE ESTE FRENTE</span>
          </div>
          {ideas.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin ideas registradas para este Frente.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {ideas.map((idea) => (
                <div key={idea.id} className="rounded-xl bg-card px-3.5 py-2.5">
                  <p className="text-[13px] leading-snug font-medium text-foreground">{idea.titulo}</p>
                  {idea.descripcion && <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{idea.descripcion}</p>}
                </div>
              ))}
            </div>
          )}
          <Link to="/compass/ideas" className="mt-3 inline-block text-[11.5px] font-semibold text-primary hover:underline">Ver todas las Ideas →</Link>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Scale className="size-3.5 text-muted-foreground" />
            <span className="font-mono-compass text-[10.5px] font-semibold tracking-[0.1em] text-muted-foreground">DECISIONES</span>
          </div>
          {decisiones.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin decisiones registradas para este Frente.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {decisiones.map((d) => (
                <div key={d.id} className="flex flex-col gap-1 border-b border-border/70 pb-3 last:border-0 last:pb-0">
                  <span className="font-mono-compass text-[10px] tracking-[0.06em] text-muted-foreground">{formatSoloFechaCorta(d.fecha).toUpperCase()}</span>
                  <span className="font-editorial text-base leading-snug text-foreground text-pretty">{d.titulo}</span>
                  {d.motivo && <span className="text-xs leading-relaxed text-muted-foreground text-pretty">{d.motivo}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  </div>
}
