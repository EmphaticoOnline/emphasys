"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { colorVarDeFrente } from "@/lib/frente-color"
import { hoyLocal } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { DecisionCreate, Frente } from "../../../services/compassService"

export function CrearDecisionDialog({ frentes, onClose, onCreate }: { frentes: Frente[]; onClose: () => void; onCreate: (payload: DecisionCreate) => Promise<unknown> }) {
  const [titulo, setTitulo] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [motivo, setMotivo] = useState("")
  const [fecha, setFecha] = useState(hoyLocal)
  const [frenteId, setFrenteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function guardar() {
    if (!titulo.trim()) return
    try {
      setSaving(true); setError("")
      await onCreate({ titulo: titulo.trim(), descripcion: descripcion.trim() || null, motivo: motivo.trim() || null, fecha, frente_id: frenteId })
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo registrar la decisión")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/20 backdrop-blur-xs sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="nueva-decision-title" className="flex max-h-[88%] w-full max-w-lg flex-col gap-5 overflow-auto rounded-t-2xl border border-border bg-popover p-5 shadow-xl sm:rounded-2xl">
        <div className="flex flex-col gap-1">
          <span className="font-mono-compass text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">Nueva decisión</span>
          <h2 id="nueva-decision-title" className="font-editorial text-2xl leading-tight text-foreground">Qué decidí y por qué</h2>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Field>
          <FieldLabel htmlFor="decision-titulo">Decisión</FieldLabel>
          <Input id="decision-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Qué se decidió" autoFocus />
        </Field>

        <Field>
          <FieldLabel htmlFor="decision-descripcion">Descripción · opcional</FieldLabel>
          <Textarea id="decision-descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className="resize-none" />
        </Field>

        <Field>
          <FieldLabel htmlFor="decision-motivo">Motivo · opcional</FieldLabel>
          <Textarea id="decision-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Por qué lo decidí así" className="resize-none" />
        </Field>

        <Field className="w-44">
          <FieldLabel htmlFor="decision-fecha">Fecha</FieldLabel>
          <Input id="decision-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>

        <Field>
          <FieldLabel>Frente · opcional</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFrenteId(null)}
              className={cn(
                "min-h-11 rounded-full border px-3.5 text-sm font-semibold",
                frenteId === null ? "border-foreground/70 bg-muted text-foreground" : "border-border bg-card text-foreground/70 hover:bg-muted",
              )}
            >
              Sin Frente
            </button>
            {frentes.map((f) => {
              const color = colorVarDeFrente(frentes, f.id)
              const activo = frenteId === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFrenteId(f.id)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold"
                  style={activo ? { borderColor: color, color, background: `color-mix(in oklch, ${color}, var(--card) 85%)` } : { borderColor: "var(--border)", color: "var(--muted-foreground)", background: "var(--card)" }}
                >
                  <span className="size-[7px] shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                  {f.nombre}
                </button>
              )
            })}
          </div>
        </Field>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void guardar()} disabled={!titulo.trim() || saving}>Registrar</Button>
        </div>
      </div>
    </div>
  )
}
