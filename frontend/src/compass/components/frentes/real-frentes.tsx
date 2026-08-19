import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, Compass, Pencil, Plus, RefreshCw } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { colorVarDeFrente } from "@/lib/frente-color"
import {
  createFrente, getFrente, listFrentes, saveIntencionSemanal, updateFrente,
  type ExpectativaAtencion, type Frente, type FrenteCategoria, type FrenteEstado,
  type IntencionPrioridad,
  listActividades, listTareas, updateTarea, type Actividad, type Tarea,
} from "../../../services/compassService"

const allStates: FrenteEstado[] = ["activo", "pausado", "completado", "archivado"]

const notaEstado: Record<"pausado" | "completado" | "archivado", string> = {
  pausado: "Sigue existiendo como dirección; no compite por atención esta semana.",
  completado: "Cerrado. Se conserva para la revisión semanal.",
  archivado: "Fuera del mapa activo; visible solo al filtrar.",
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

export function RealFrenteDetailView() {
  const params = useParams()
  const id = Number(params.id)
  const [frente, setFrente] = useState<Frente | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(false)
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
  const loadTrabajo = useCallback(async () => {
    if (!Number.isInteger(id)) return
    const [nextTareas, nextActividades] = await Promise.all([listTareas({ frente_id: id }), listActividades({ frente_id: id })])
    setTareas(nextTareas); setActividades(nextActividades.slice(-8).reverse())
  }, [id])
  const load = useCallback(async () => {
    try { setLoading(true); setError(""); const data = await getFrente(id); setFrente(data); setNombre(data.nombre); setProposito(data.proposito); setCategoria(data.categoria); setEstado(data.estado); if (data.intencion_semanal) { setPrioridad(data.intencion_semanal.prioridad); setComentario(data.intencion_semanal.comentario ?? ""); if (data.intencion_semanal.horas_objetivo != null) { setMode("horas"); setHoras(String(data.intencion_semanal.horas_objetivo)) } else { setMode("expectativa"); setExpectativa(data.intencion_semanal.expectativa_atencion ?? "atender") } } }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar el Frente") }
    finally { setLoading(false) }
  }, [id])
  useEffect(() => { void load() }, [load])
  useEffect(() => { void loadTrabajo() }, [loadTrabajo])
  const saveFrente = async () => { try { setSaving(true); setError(""); const data = await updateFrente(id, { nombre, proposito, categoria, estado }); setFrente(data); setEditing(false) } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar el Frente") } finally { setSaving(false) } }
  const saveIntent = async () => { try { setSaving(true); setError(""); await saveIntencionSemanal(id, { semana_inicio: monday(), prioridad, horas_objetivo: mode === "horas" ? Number(horas) : null, expectativa_atencion: mode === "expectativa" ? expectativa : null, comentario: comentario.trim() || null }); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar la intención") } finally { setSaving(false) } }
  if (loading) return <Status loading error="" retry={() => void load()} />
  if (!frente) return <div className="flex flex-col gap-4"><p className="text-sm text-destructive">{error || "No se encontró este Frente."}</p><Link to="/compass/frentes" className="text-sm underline">Volver a Frentes</Link></div>
  return <div className="flex flex-col gap-10">
    <Link to="/compass/frentes" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Frentes</Link>
    {error && <p className="rounded-xl border border-destructive/30 bg-card px-4 py-3 text-sm text-destructive">{error}</p>}
    <header className="flex flex-col gap-3"><div className="flex items-center gap-2.5"><span className="size-2.5 rounded-full bg-congruent" /><Badge variant="secondary">{pretty(frente.categoria)}</Badge>{frente.estado !== "activo" && <Badge variant="outline">{pretty(frente.estado)}</Badge>}<button onClick={() => setEditing((value) => !value)} className="ml-auto rounded-full p-2 text-muted-foreground hover:bg-secondary"><Pencil className="size-4" /></button></div><h1 className="font-heading text-3xl tracking-tight text-foreground">{frente.nombre}</h1><p className="max-w-lg text-sm leading-relaxed text-muted-foreground">{frente.proposito}</p></header>
    {editing && <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-5 py-4"><Field><FieldLabel>Nombre</FieldLabel><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field><Field><FieldLabel>Propósito</FieldLabel><Textarea value={proposito} onChange={(e) => setProposito(e.target.value)} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>Categoría</FieldLabel><select value={categoria} onChange={(e) => setCategoria(e.target.value as FrenteCategoria)} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"><option value="profesional">Profesional</option><option value="personal">Personal</option></select></Field><Field><FieldLabel>Estado</FieldLabel><select value={estado} onChange={(e) => setEstado(e.target.value as FrenteEstado)} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">{allStates.map((item) => <option value={item} key={item}>{pretty(item)}</option>)}</select></Field></div><div className="flex gap-2"><Button onClick={saveFrente} disabled={saving}>Guardar cambios</Button><Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button></div></section>}
    <section className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/[0.04] px-5 py-4"><div className="flex items-center gap-2 text-primary"><Compass className="size-3.5" /><h2 className="font-heading text-sm">Siguiente acción</h2></div><select value={tareas.find(t => t.es_siguiente_accion)?.id ?? ""} onChange={async e => { const next = Number(e.target.value); const current = tareas.find(t => t.es_siguiente_accion); if (!next && current) await updateTarea(current.id, { es_siguiente_accion: false }); else if (next) await updateTarea(next, { es_siguiente_accion: true }); await Promise.all([load(), loadTrabajo()]) }} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"><option value="">Sin siguiente acción</option>{tareas.filter(t => t.estado === "pendiente" || t.estado === "en_curso").map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}</select></section>
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-5 py-4"><div><h2 className="font-heading text-sm text-muted-foreground">Intención esta semana</h2><p className="mt-1 text-xs text-muted-foreground">Semana del {monday()}</p></div><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>Prioridad</FieldLabel><select value={prioridad} onChange={(e) => setPrioridad(e.target.value as IntencionPrioridad)} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></Field><Field><FieldLabel>Tipo de objetivo</FieldLabel><select value={mode} onChange={(e) => setMode(e.target.value as "horas" | "expectativa")} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"><option value="horas">Horas objetivo</option><option value="expectativa">Expectativa de atención</option></select></Field></div>{mode === "horas" ? <Field><FieldLabel>Horas objetivo</FieldLabel><Input type="number" min="0.01" max="9999.99" step="0.25" value={horas} onChange={(e) => setHoras(e.target.value)} /></Field> : <Field><FieldLabel>Expectativa</FieldLabel><select value={expectativa} onChange={(e) => setExpectativa(e.target.value as ExpectativaAtencion)} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"><option value="sin_compromiso">Sin compromiso</option><option value="atender">Atender</option><option value="prioritario">Prioritario</option></select></Field>}<Field><FieldLabel>Comentario opcional</FieldLabel><Textarea value={comentario} onChange={(e) => setComentario(e.target.value)} className="min-h-20 resize-none" /></Field><Button className="self-start" onClick={saveIntent} disabled={saving || (mode === "horas" && !(Number(horas) > 0))}>{frente.intencion_semanal ? "Actualizar intención" : "Definir intención"}</Button></section>
    <section className="grid gap-6 md:grid-cols-2"><div className="flex flex-col gap-3"><h2 className="font-heading text-sm text-muted-foreground">Tareas del Frente</h2><div className="rounded-2xl border border-border bg-card">{tareas.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">No hay tareas.</p> : tareas.map(t => <div key={t.id} className="border-b border-border px-5 py-3 last:border-0"><p className={`text-sm ${t.estado === "completada" ? "line-through text-muted-foreground" : ""}`}>{t.titulo}</p><p className="text-xs text-muted-foreground">{pretty(t.estado)}{t.fecha_limite ? ` · ${t.fecha_limite}` : ""}</p></div>)}</div></div><div className="flex flex-col gap-3"><h2 className="font-heading text-sm text-muted-foreground">Actividades recientes</h2><div className="rounded-2xl border border-border bg-card">{actividades.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">No hay actividades.</p> : actividades.map(a => <div key={a.id} className="border-b border-border px-5 py-3 last:border-0"><p className="text-sm">{a.titulo}</p><p className="text-xs text-muted-foreground">{new Date(a.inicio_programado).toLocaleString("es-MX")} · {pretty(a.estado)}</p></div>)}</div></div></section>
  </div>
}
