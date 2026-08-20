"use client"

import { CalendarPlus, Compass, Lightbulb, ListChecks, ScrollText } from "lucide-react"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { Captura, FrenteCategoria } from "../../../services/compassService"
import type { Destino } from "./use-procesar-captura"

const OPCIONES: { value: Destino; label: string; icon: typeof ListChecks }[] = [
  { value: "tarea", label: "Tarea", icon: ListChecks },
  { value: "actividad", label: "Actividad", icon: CalendarPlus },
  { value: "idea", label: "Idea", icon: Lightbulb },
  { value: "decision", label: "Decisión", icon: ScrollText },
  { value: "frente", label: "Frente", icon: Compass },
]

type ProcesarCapturaCamposProps = {
  captura: Captura
  frentes: { id: number; nombre: string }[]
  destino: Destino | null
  setDestino: (d: Destino) => void
  frenteId: string
  setFrenteId: (v: string) => void
  fecha: string
  setFecha: (v: string) => void
  hora: string
  setHora: (v: string) => void
  nombre: string
  setNombre: (v: string) => void
  proposito: string
  setProposito: (v: string) => void
  categoria: FrenteCategoria
  setCategoria: (c: FrenteCategoria) => void
}

export function ProcesarCapturaCampos({
  captura, frentes, destino, setDestino, frenteId, setFrenteId, fecha, setFecha, hora, setHora,
  nombre, setNombre, proposito, setProposito, categoria, setCategoria,
}: ProcesarCapturaCamposProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="mb-2.5 block font-mono-compass text-[10.5px] tracking-[0.1em] text-muted-foreground uppercase">¿En qué se convierte?</span>
        <div className="flex flex-wrap gap-2">
          {OPCIONES.map((o) => {
            const activo = destino === o.value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setDestino(o.value)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium",
                  activo ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground/80 hover:bg-muted",
                )}
              >
                <o.icon className="size-4" />
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      {destino && destino !== "frente" && (
        <Field>
          <FieldLabel htmlFor="captura-frente">Frente relacionado (opcional)</FieldLabel>
          <select id="captura-frente" value={frenteId} onChange={(e) => setFrenteId(e.target.value)} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm">
            <option value="">Sin Frente</option>
            {frentes.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
          </select>
        </Field>
      )}

      {destino === "actividad" && (
        <div className="flex gap-3">
          <Field className="flex-1">
            <FieldLabel htmlFor="captura-fecha">Fecha</FieldLabel>
            <Input id="captura-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-10" />
          </Field>
          <Field className="flex-1">
            <FieldLabel htmlFor="captura-hora">Hora</FieldLabel>
            <Input id="captura-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="h-10" />
          </Field>
        </div>
      )}

      {destino === "frente" && (
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="captura-nombre">Nombre del Frente</FieldLabel>
            <Input id="captura-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={captura.texto.slice(0, 40)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="captura-proposito">Propósito (opcional)</FieldLabel>
            <Textarea id="captura-proposito" value={proposito} onChange={(e) => setProposito(e.target.value)} className="min-h-20 resize-none" />
          </Field>
          <Field>
            <FieldLabel htmlFor="captura-categoria">Categoría</FieldLabel>
            <select id="captura-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as FrenteCategoria)} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm">
              <option value="personal">Personal</option>
              <option value="profesional">Profesional</option>
            </select>
          </Field>
        </div>
      )}

      {destino === "decision" && (
        <Field>
          <FieldLabel htmlFor="captura-motivo">Motivo (opcional)</FieldLabel>
          <Textarea id="captura-motivo" value={proposito} onChange={(e) => setProposito(e.target.value)} placeholder="Qué llevó a esta decisión" className="min-h-20 resize-none" />
        </Field>
      )}

      {!destino && (
        <p className="font-mono-compass text-[10.5px] tracking-[0.08em] text-muted-foreground/80 uppercase">Elige un destino para ver sus campos</p>
      )}
    </div>
  )
}
