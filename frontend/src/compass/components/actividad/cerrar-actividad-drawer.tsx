"use client"

import { useEffect, useState } from "react"
import { CalendarClock, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { ResponsiveOperationOverlay } from "@/components/ui/responsive-operation-overlay"
import { Textarea } from "@/components/ui/textarea"
import { fechaHoraLocalAISOString, formatFechaHora, formatHora } from "@/lib/format"
import { useRealWork } from "@/lib/real-work-store"
import type { Actividad, ActividadEstado } from "../../../services/compassService"

type Modo = "cerrar" | "reprogramar" | "siguiente"
const estados: Exclude<ActividadEstado, "programada">[] = ["realizada", "parcial", "no_realizada", "cancelada"]

export function CerrarActividadDrawer({ actividad, open, onOpenChange, onSaved, modoInicial }: { actividad: Actividad | null; open: boolean; onOpenChange: (value: boolean) => void; onSaved?: () => void | Promise<void>; modoInicial?: Modo }) {
  const { cerrarActividad, reprogramarActividad, continuarActividad, loading } = useRealWork()
  const [modo, setModo] = useState<Modo>("cerrar")
  const [estado, setEstado] = useState<Exclude<ActividadEstado, "programada">>("realizada")
  const [minutos, setMinutos] = useState("")
  const [resultado, setResultado] = useState("")
  const [nuevoInicio, setNuevoInicio] = useState("")

  useEffect(() => {
    if (!actividad || !open) return
    setModo(modoInicial ?? "cerrar")
    setEstado("realizada")
    setMinutos(String(Math.round((new Date(actividad.fin_programado).getTime() - new Date(actividad.inicio_programado).getTime()) / 60000)))
    setResultado("")
    setNuevoInicio("")
  }, [actividad, open, modoInicial])

  if (!actividad) return null

  const persist = async () => {
    if (modo === "cerrar") {
      await cerrarActividad(actividad.id, { estado, minutos_efectivos: estado === "realizada" || estado === "parcial" ? Number(minutos) || 0 : null, resultado: resultado.trim() || null })
    } else {
      if (!nuevoInicio) return
      const start = new Date(fechaHoraLocalAISOString(nuevoInicio))
      const duration = new Date(actividad.fin_programado).getTime() - new Date(actividad.inicio_programado).getTime()
      const payload = { nuevo_inicio: start.toISOString(), nuevo_fin: new Date(start.getTime() + duration).toISOString() }
      if (modo === "reprogramar") await reprogramarActividad(actividad.id, payload)
      else await continuarActividad(actividad.id, payload)
    }
    onOpenChange(false)
    await onSaved?.()
  }

  return (
    <ResponsiveOperationOverlay
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={modo === "cerrar" ? "Cerrar actividad" : modo === "reprogramar" ? "Reprogramar actividad" : "Programar siguiente actividad"}
      title={actividad.titulo}
      description={`${formatFechaHora(actividad.inicio_programado)} – ${formatHora(actividad.fin_programado)}`}
      footerClassName="sm:flex-col sm:items-stretch"
      footer={modo === "cerrar" ? (
        <>
          <Button onClick={() => void persist()} disabled={loading}>Cerrar actividad</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setModo("reprogramar")}><RotateCcw />Reprogramar</Button>
            <Button variant="outline" onClick={() => setModo("siguiente")}><CalendarClock />Programar siguiente</Button>
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
        </>
      ) : (
        <>
          <Button onClick={() => void persist()} disabled={!nuevoInicio || loading}>{modo === "reprogramar" ? "Confirmar reprogramación" : "Crear siguiente actividad"}</Button>
          <Button variant="ghost" onClick={() => setModo("cerrar")}>Volver</Button>
        </>
      )}
    >
      {modo === "cerrar" ? (
        <>
          <Field><FieldLabel>¿Se realizó?</FieldLabel><select value={estado} onChange={(event) => setEstado(event.target.value as Exclude<ActividadEstado, "programada">)} className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus-visible:border-ring/70 focus-visible:ring-2 focus-visible:ring-ring/20">{estados.map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}</select></Field>
          {(estado === "realizada" || estado === "parcial") && <Field><FieldLabel>Tiempo efectivo (minutos)</FieldLabel><input type="number" min={0} value={minutos} onChange={(event) => setMinutos(event.target.value)} className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus-visible:border-ring/70 focus-visible:ring-2 focus-visible:ring-ring/20" /></Field>}
          <Field><FieldLabel>Resultado o comentario</FieldLabel><Textarea value={resultado} onChange={(event) => setResultado(event.target.value)} className="rounded-xl border-border bg-card px-3.5 py-3 focus-visible:border-ring/70 focus-visible:ring-2 focus-visible:ring-ring/20" /></Field>
        </>
      ) : (
        <Field><FieldLabel>Nueva fecha y hora</FieldLabel><input type="datetime-local" value={nuevoInicio} onChange={(event) => setNuevoInicio(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus-visible:border-ring/70 focus-visible:ring-2 focus-visible:ring-ring/20" /></Field>
      )}
    </ResponsiveOperationOverlay>
  )
}
