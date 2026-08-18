"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRealWork } from "@/lib/real-work-store"
import { formatFechaCorta } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { IntencionPrioridad } from "../../../services/compassService"

const filtros = ["Pendientes", "Todas"] as const
const prioridadOrden = { alta: 0, media: 1, baja: 2 } as const

export function TareasView() {
  const { tareas, frentes, loading, error, loadTareas, loadFrentes, crearTarea, actualizarTarea } = useRealWork()
  const [filtro, setFiltro] = useState<(typeof filtros)[number]>("Pendientes")
  const [creating, setCreating] = useState(false)
  const [titulo, setTitulo] = useState(""); const [frenteId, setFrenteId] = useState(""); const [fecha, setFecha] = useState("")
  const [prioridad, setPrioridad] = useState<IntencionPrioridad | "">("")
  useEffect(() => { void loadFrentes() }, [loadFrentes])
  useEffect(() => { void loadTareas(filtro === "Pendientes" ? { pendientes: true } : {}) }, [filtro, loadTareas])
  const visibles = useMemo(() => [...tareas].sort((a, b) => {
    const pa = a.prioridad_operativa ? prioridadOrden[a.prioridad_operativa] : 3
    const pb = b.prioridad_operativa ? prioridadOrden[b.prioridad_operativa] : 3
    return pa - pb || (a.fecha_limite ?? "9999").localeCompare(b.fecha_limite ?? "9999")
  }), [tareas])
  async function guardar() {
    if (!titulo.trim()) return
    await crearTarea({ titulo: titulo.trim(), frente_id: frenteId ? Number(frenteId) : null, fecha_limite: fecha || null, prioridad_operativa: prioridad || null, es_siguiente_accion: false })
    setTitulo(""); setFrenteId(""); setFecha(""); setPrioridad(""); setCreating(false)
    await loadTareas(filtro === "Pendientes" ? { pendientes: true } : {})
  }
  return <div className="flex flex-col gap-8">
    <header className="flex items-start justify-between gap-3"><div><h1 className="font-heading text-3xl tracking-tight text-foreground">Tareas</h1><p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Compromisos concretos. Cada tarea puede pertenecer a un frente, o no — no todo necesita una dirección.</p></div><Button onClick={() => setCreating(true)}><Plus />Nueva</Button></header>
    <div className="flex items-center gap-2">{filtros.map(f => <button key={f} onClick={() => setFiltro(f)} className={cn("rounded-full px-3.5 py-1.5 text-xs font-medium", filtro === f ? "bg-foreground text-background" : "bg-secondary text-muted-foreground")}>{f}</button>)}</div>
    {error && <p className="rounded-xl border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</p>}
    <div className="flex flex-col rounded-2xl border border-border bg-card">{loading && visibles.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">Cargando tareas…</p> : visibles.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">No hay tareas para mostrar.</p> : visibles.map((t, i) => <label key={t.id} className={cn("flex items-start gap-3 px-4 py-3.5", i !== 0 && "border-t border-border")}><input type="checkbox" checked={t.estado === "completada"} onChange={async () => { await actualizarTarea(t.id, { estado: t.estado === "completada" ? "pendiente" : "completada" }); await loadTareas(filtro === "Pendientes" ? { pendientes: true } : {}) }} className="mt-0.5 size-4 accent-foreground" /><div className="flex flex-1 flex-col gap-1"><span className={cn("text-sm text-foreground", t.estado === "completada" && "text-muted-foreground line-through")}>{t.titulo}</span><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{t.frente_nombre && <span>{t.frente_nombre}</span>}{t.fecha_limite && <span>{formatFechaCorta(t.fecha_limite)}</span>}{t.prioridad_operativa && <span>Prioridad {t.prioridad_operativa}</span>}{t.es_siguiente_accion && <span className="text-primary">Siguiente acción</span>}</div></div></label>)}</div>
    {creating && <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/20 sm:items-center sm:p-4" onMouseDown={e => e.target === e.currentTarget && setCreating(false)}><div className="w-full max-w-lg rounded-t-2xl border border-border bg-popover p-5 shadow-xl sm:rounded-2xl"><h2 className="font-heading text-xl">Nueva tarea</h2><div className="mt-5 flex flex-col gap-4"><Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Qué necesitas hacer" autoFocus /><select value={frenteId} onChange={e => setFrenteId(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"><option value="">Sin Frente</option>{frentes.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}</select><div className="grid grid-cols-2 gap-3"><Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /><select value={prioridad} onChange={e => setPrioridad(e.target.value as IntencionPrioridad | "")} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"><option value="">Sin prioridad</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></div></div><div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button><Button onClick={() => void guardar()} disabled={!titulo.trim() || loading}>Crear tarea</Button></div></div></div>}
  </div>
}
