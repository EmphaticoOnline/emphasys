"use client"
import { useCallback,useEffect,useState } from "react"
import { ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"
import { ActividadRow } from "@/components/actividad/actividad-row"
import { CerrarActividadDrawer } from "@/components/actividad/cerrar-actividad-drawer"
import { useRealWork } from "@/lib/real-work-store"
import type { Actividad } from "../../../services/compassService"
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
const iso=(day:string,plus=0)=>{const d=new Date(`${day}T00:00:00`);d.setDate(d.getDate()+plus);return d.toISOString()}
export function HoyView(){
 const day=today();const {actividades,frentes,tareas,loading,error,loadActividades,loadFrentes,loadTareas}=useRealWork();const [selected,setSelected]=useState<Actividad|null>(null)
 const load=useCallback(async()=>{await Promise.all([loadActividades({fecha_inicio:iso(day),fecha_fin:iso(day,1)}),loadFrentes(),loadTareas({pendientes:true})])},[day,loadActividades,loadFrentes,loadTareas]);useEffect(()=>{void load()},[load])
 const actions=tareas.filter(t=>t.es_siguiente_accion).slice(0,3)
 return <div className="flex flex-col gap-10"><header><p className="text-xs tracking-wide text-muted-foreground uppercase">{new Date(`${day}T12:00:00`).toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"})}</p><h1 className="font-heading text-3xl tracking-tight">Hoy</h1><p className="mt-2 text-sm text-muted-foreground">¿Tu tiempo va a contar hoy la misma historia que tus prioridades?</p></header>{error&&<p className="text-sm text-destructive">{error}</p>}<section className="flex flex-col gap-3"><h2 className="font-heading text-sm text-muted-foreground">Actividades de hoy</h2><div className="rounded-2xl border border-border bg-card">{loading&&actividades.length===0?<p className="px-4 py-6 text-sm text-muted-foreground">Cargando…</p>:actividades.length===0?<p className="px-4 py-6 text-sm text-muted-foreground">No tienes actividades programadas para hoy.</p>:actividades.filter(a=>a.estado!=="cancelada").map(a=><ActividadRow key={a.id} actividad={a} onSelect={setSelected}/>)}</div></section><section className="flex flex-col gap-3"><h2 className="font-heading text-sm text-muted-foreground">Siguientes acciones</h2>{actions.length===0?<p className="text-sm text-muted-foreground">No hay siguientes acciones definidas.</p>:actions.map(t=><Link key={t.id} to={t.frente_id?`/compass/frentes/${t.frente_id}`:"/compass/tareas"} className="flex items-center rounded-xl border border-border bg-card px-4 py-3.5"><div className="flex-1"><p className="text-sm font-medium">{t.titulo}</p><p className="text-xs text-muted-foreground">{t.frente_nombre??"Sin Frente"}</p></div><ArrowRight className="size-4 text-muted-foreground"/></Link>)}</section><CerrarActividadDrawer actividad={selected} open={!!selected} onOpenChange={v=>!v&&setSelected(null)} onSaved={load}/></div>
}

