"use client"
import { useEffect,useState } from "react"
import { Empty,EmptyDescription,EmptyHeader,EmptyMedia,EmptyTitle } from "@/components/ui/empty"
import { Inbox } from "lucide-react"
import { ProcesarCapturaSheet } from "@/components/bandeja/procesar-captura-sheet"
import { useRealWork } from "@/lib/real-work-store"
import type { Captura } from "../../../services/compassService"
export function BandejaView(){
 const {capturas,loading,error,loadCapturas}=useRealWork();const [selected,setSelected]=useState<Captura|null>(null)
 useEffect(()=>{void loadCapturas()},[loadCapturas])
 return <div className="flex flex-col gap-8"><header><h1 className="font-heading text-3xl tracking-tight">Bandeja</h1><p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Todo lo que capturaste, sin filtrar. Decide qué es cada cosa cuando tengas espacio para pensarlo.</p></header>{error&&<p className="rounded-xl border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</p>}{loading&&capturas.length===0?<p className="text-sm text-muted-foreground">Cargando Bandeja…</p>:capturas.length===0?<Empty><EmptyHeader><EmptyMedia variant="icon"><Inbox/></EmptyMedia><EmptyTitle>Bandeja vacía</EmptyTitle><EmptyDescription>No tienes capturas pendientes de procesar.</EmptyDescription></EmptyHeader></Empty>:<div className="flex flex-col rounded-2xl border border-border bg-card">{capturas.map((item,i)=><button key={item.id} onClick={()=>setSelected(item)} className={`flex w-full flex-col gap-1 px-4 py-3.5 text-left hover:bg-accent/50 ${i?"border-t border-border":""}`}><p className="text-sm leading-relaxed">{item.texto}</p><span className="text-xs text-muted-foreground">{new Date(item.captured_at).toLocaleString("es-MX")}</span></button>)}</div>}<ProcesarCapturaSheet captura={selected} open={!!selected} onOpenChange={v=>!v&&setSelected(null)} restantes={Math.max(capturas.length-1,0)} onProcesada={async()=>{setSelected(null);await loadCapturas()}}/></div>
}

