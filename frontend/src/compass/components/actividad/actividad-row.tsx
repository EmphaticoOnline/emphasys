"use client"
import { CheckCircle2, CircleDashed, CircleSlash, XCircle } from "lucide-react"
import { useRealWork } from "@/lib/real-work-store"
import { cn } from "@/lib/utils"
import type { Actividad } from "../../../services/compassService"
import { formatHora } from "@/lib/format"
const cerrado = { realizada: { icon: CheckCircle2, css: "text-congruent" }, parcial: { icon: CircleDashed, css: "text-at-risk" }, no_realizada: { icon: XCircle, css: "text-neglected" }, cancelada: { icon: CircleSlash, css: "text-muted-foreground" } } as const
const hora = formatHora
export function ActividadRow({actividad,onSelect}:{actividad:Actividad;onSelect:(actividad:Actividad)=>void}) {
 const { frentes }=useRealWork(); const frente=frentes.find(f=>f.id===actividad.frente_id); const cierre=actividad.estado === "programada" ? null : cerrado[actividad.estado]
 return <button type="button" onClick={()=>onSelect(actividad)} className="group flex w-full items-start gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-accent/50"><div className="flex w-16 shrink-0 flex-col pt-0.5 text-xs text-muted-foreground tabular-nums"><span>{hora(actividad.inicio_programado)}</span><span>{hora(actividad.fin_programado)}</span></div><div className="mt-1 h-full w-px shrink-0 self-stretch bg-border" /><div className="flex flex-1 flex-col gap-0.5 pl-1"><p className={cn("text-sm text-foreground",cierre&&"text-muted-foreground")}>{actividad.titulo}</p>{frente&&<p className="text-xs text-muted-foreground">{frente.nombre}</p>}</div>{cierre&&<cierre.icon className={cn("mt-0.5 size-4",cierre.css)} />}</button>
}
