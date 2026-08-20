"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { fechaYHoraLocalAISOString } from "@/lib/format"
import { cn } from "@/lib/utils"
import { convertIdea, type ConvertirIdea, type Idea } from "../../../services/compassService"

type Destino = "tarea" | "actividad" | "frente"
const DESTINOS: { value: Destino; label: string }[] = [
  { value: "tarea", label: "Tarea" },
  { value: "actividad", label: "Actividad" },
  { value: "frente", label: "Frente" },
]

export function ConvertirIdeaDialog({ idea, onClose, onConverted }: { idea: Idea; onClose: () => void; onConverted: () => void | Promise<void> }) {
  const [destino, setDestino] = useState<Destino>("tarea")
  const [fecha, setFecha] = useState("")
  const [hora, setHora] = useState("")
  const [nombre, setNombre] = useState(idea.titulo)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => { setDestino("tarea"); setFecha(""); setHora(""); setNombre(idea.titulo); setError("") }, [idea.id])

  const puedeConvertir = destino !== "actividad" || (!!fecha && !!hora)
  const puedeConvertirFrente = destino !== "frente" || nombre.trim().length > 0
  const valido = puedeConvertir && puedeConvertirFrente

  async function confirmar() {
    if (!valido) return
    let payload: ConvertirIdea
    if (destino === "tarea") {
      payload = { destino, frente_id: idea.frente_id }
    } else if (destino === "actividad") {
      const inicio = fechaYHoraLocalAISOString(fecha, hora)
      const fin = new Date(new Date(inicio).getTime() + 3600000).toISOString()
      payload = { destino, frente_id: idea.frente_id, tarea_id: null, inicio_programado: inicio, fin_programado: fin }
    } else {
      payload = { destino, nombre: nombre.trim(), proposito: idea.descripcion || idea.titulo, categoria: "personal" }
    }
    try {
      setSaving(true); setError("")
      await convertIdea(idea.id, payload)
      await onConverted()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo convertir la idea")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/20 backdrop-blur-xs sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="convertir-idea-title" className="flex max-h-[88%] w-full max-w-lg flex-col gap-5 overflow-auto rounded-t-2xl border border-border bg-popover p-5 shadow-xl sm:rounded-2xl">
        <div className="flex flex-col gap-1">
          <span className="font-mono-compass text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">Convertir idea</span>
          <h2 id="convertir-idea-title" className="font-editorial text-2xl leading-tight text-pretty text-foreground">{idea.titulo}</h2>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Field>
          <FieldLabel>Destino</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {DESTINOS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDestino(d.value)}
                className={cn(
                  "min-h-11 rounded-xl border text-sm font-semibold",
                  destino === d.value ? "border-transparent bg-foreground text-background" : "border-border bg-card text-foreground/80 hover:bg-muted",
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </Field>

        {destino === "actividad" && (
          <div className="flex gap-3">
            <Field className="flex-1">
              <FieldLabel htmlFor="convertir-fecha">Fecha</FieldLabel>
              <Input id="convertir-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </Field>
            <Field className="flex-1">
              <FieldLabel htmlFor="convertir-hora">Hora</FieldLabel>
              <Input id="convertir-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </Field>
          </div>
        )}

        {destino === "frente" && (
          <Field>
            <FieldLabel htmlFor="convertir-nombre">Nombre del Frente</FieldLabel>
            <Input id="convertir-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Cómo se llamará" />
          </Field>
        )}

        <p className="rounded-xl bg-[var(--surface-sunken)] px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground">
          Al convertir, la idea se archiva y conserva su origen. Sigue visible en Archivadas.
        </p>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void confirmar()} disabled={!valido || saving}>Convertir</Button>
        </div>
      </div>
    </div>
  )
}
