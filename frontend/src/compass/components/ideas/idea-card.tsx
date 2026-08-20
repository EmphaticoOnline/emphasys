"use client"

import { colorVarDeFrente } from "@/lib/frente-color"
import { formatFechaCorta } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Link } from "react-router-dom"
import type { Frente, Idea } from "../../../services/compassService"

const TIPO_CONVERSION_LABEL: Record<NonNullable<Idea["tipo_conversion"]>, string> = {
  tarea: "Tarea",
  actividad: "Actividad",
  frente: "Frente",
}

export function IdeaCard({
  idea,
  frentes,
  onConvertir,
  onArchivar,
  onReactivar,
}: {
  idea: Idea
  frentes: Frente[]
  onConvertir: () => void
  onArchivar: () => void
  onReactivar: () => void
}) {
  const color = colorVarDeFrente(frentes, idea.frente_id)
  const archivada = idea.estado === "archivada"

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card px-5 py-4">
      <div className="flex flex-col gap-2">
        {idea.frente_id != null && (
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{ background: `color-mix(in oklch, ${color}, var(--card) 85%)` }}
          >
            <span className="size-[7px] shrink-0 rounded-full" style={{ background: color }} aria-hidden />
            <span className="font-mono-compass text-[10px] tracking-[0.1em] uppercase" style={{ color }}>{idea.frente_nombre}</span>
          </span>
        )}
        <p className={cn("font-editorial text-[22px] leading-snug text-pretty", archivada ? "text-foreground/70" : "text-foreground")}>
          {idea.titulo}
        </p>
        {idea.descripcion && <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{idea.descripcion}</p>}
      </div>

      {idea.tipo_conversion && (
        <div className="flex flex-col gap-1 rounded-xl bg-[var(--surface-sunken)] px-3.5 py-2.5">
          <span className="font-mono-compass text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
            Convertida en {TIPO_CONVERSION_LABEL[idea.tipo_conversion]}
          </span>
          {idea.tipo_conversion === "frente" && idea.conversion_id != null ? (
            <Link to={`/compass/frentes/${idea.conversion_id}`} className="text-xs font-semibold text-primary hover:underline">
              Ver el Frente →
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">Conserva su origen, archivada {idea.fecha_archivo ? formatFechaCorta(idea.fecha_archivo) : ""}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="font-mono-compass text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
          {archivada
            ? `Archivada ${idea.fecha_archivo ? formatFechaCorta(idea.fecha_archivo) : ""}`
            : `Anotada ${formatFechaCorta(idea.created_at)}`}
        </span>
        <div className="flex gap-2">
          {!idea.tipo_conversion && (
            <button
              type="button"
              onClick={archivada ? onReactivar : onArchivar}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted"
            >
              {archivada ? "Reactivar" : "Archivar"}
            </button>
          )}
          {idea.estado === "activa" && (
            <button type="button" onClick={onConvertir} className="rounded-lg border border-foreground/80 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted">
              Convertir
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
