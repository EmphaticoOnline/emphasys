import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, Compass, Pencil, Plus, RefreshCw } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  createFrente, getFrente, listFrentes, saveIntencionSemanal, updateFrente,
  type ExpectativaAtencion, type Frente, type FrenteCategoria, type FrenteEstado,
  type IntencionPrioridad,
  listActividades, listTareas, updateTarea, type Actividad, type Tarea,
} from "../../../services/compassService"

const allStates: FrenteEstado[] = ["activo", "pausado", "completado", "archivado"]
const colors = ["congruent", "at-risk", "overattended", "neglected"]

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

function Status({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (loading) return <div className="rounded-2xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">Cargando Frentes…</div>
  if (!error) return null
  return <div className="rounded-2xl border border-destructive/30 bg-card px-5 py-5 text-sm text-destructive"><p>{error}</p><Button variant="outline" className="mt-3" onClick={retry}><RefreshCw />Reintentar</Button></div>
}

function FrenteCard({ frente, index }: { frente: Frente; index: number }) {
  const inactivo = frente.estado !== "activo"
  return <Link to={`/compass/frentes/${frente.id}`} className={`group flex flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary/30 ${inactivo ? "opacity-60" : ""}`}>
    <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2.5"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: `var(--${colors[index % colors.length]})` }} /><div><p className="text-sm font-medium text-foreground">{frente.nombre}</p><p className="text-xs text-muted-foreground">{pretty(frente.categoria)}</p></div></div><ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div>
    <p className="text-sm leading-relaxed text-muted-foreground">{frente.proposito}</p>
    <div className="flex items-center justify-between border-t border-border pt-3"><span className="text-xs text-muted-foreground">{pretty(frente.estado)}</span><span className="text-xs text-muted-foreground">{frente.horas_objetivo != null ? `${frente.horas_objetivo}h objetivo` : pretty(frente.expectativa_atencion)}</span></div>
  </Link>
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
  return <div className="flex flex-col gap-8">
    <header className="flex flex-col gap-2"><div className="flex items-start justify-between gap-3"><div><h1 className="font-heading text-3xl tracking-tight text-foreground">Frentes</h1><p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Los frentes son las áreas de tu vida a las que decidiste prestar atención. No son tareas — son direcciones.</p></div><Button onClick={() => setCreating(true)}><Plus />Nuevo</Button></div></header>
    <div className="flex items-center gap-2">{([['todos','Todos'],['profesional','Profesional'],['personal','Personal']] as const).map(([value, text]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${filter === value ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>{text}</button>)}</div>
    <Status loading={loading} error={error} retry={() => void load()} />
    {!loading && !error && visible.length === 0 && <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center"><p className="font-heading text-lg">Aún no hay Frentes</p><p className="mt-2 text-sm text-muted-foreground">Crea el primero para definir su intención semanal.</p><Button className="mt-4" onClick={() => setCreating(true)}><Plus />Crear Frente</Button></div>}
    <section className="flex flex-col gap-3">{activos.map((item, index) => <FrenteCard key={item.id} frente={item} index={index} />)}</section>
    {otros.length > 0 && <section className="flex flex-col gap-3"><div className="flex items-center gap-2"><h2 className="font-heading text-sm text-muted-foreground">Sin actividad reciente</h2><Badge variant="secondary">{otros.length}</Badge></div>{otros.map((item, index) => <FrenteCard key={item.id} frente={item} index={index + activos.length} />)}</section>}
    <NewFrente open={creating} close={() => setCreating(false)} saved={(frente) => { setCreating(false); navigate(`/compass/frentes/${frente.id}`) }} />
  </div>
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
