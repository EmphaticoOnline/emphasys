"use client"

import { Pencil, Trash2, X } from "lucide-react"
import { colorVarDeFrente } from "@/lib/frente-color"
import { capitalizarPrimera, duracionMinutos, formatDuracionMin, formatFechaLarga, formatHora24 } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Actividad, Frente } from "../../../services/compassService"
import { ESTADO_GLYPH, ESTADO_LABEL } from "./estado-actividad-visual"

export type ModoGestion = "cerrar" | "reprogramar" | "siguiente"

export function ActividadDetallePanel({
  actividad,
  actividades,
  frentes,
  onClose,
  onGestionar,
  onEditar,
  onEliminar,
}: {
  actividad: Actividad
  actividades: Actividad[]
  frentes: Frente[]
  onClose: () => void
  onGestionar: (modo: ModoGestion) => void
  onEditar: () => void
  onEliminar: () => void
}) {
  const color = colorVarDeFrente(frentes, actividad.frente_id)
  const programada = actividad.estado === "programada"
  const duracionProgramada = duracionMinutos(actividad.inicio_programado, actividad.fin_programado)

  const origen = actividad.actividad_origen_id != null ? actividades.find((a) => a.id === actividad.actividad_origen_id) : undefined
  const derivada = actividades.find((a) => a.actividad_origen_id === actividad.id)

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/20 backdrop-blur-xs sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="detalle-actividad-title" className="flex max-h-[88%] w-full max-w-lg flex-col gap-5 overflow-auto rounded-t-2xl border border-border bg-popover p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h2 id="detalle-actividad-title" className="font-editorial text-[26px] leading-tight text-pretty text-foreground">{actividad.titulo}</h2>
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 font-mono-compass text-[10px] tracking-[0.08em] text-foreground uppercase"
                style={{ background: `color-mix(in oklch, ${color}, var(--card) 84%)` }}
              >
                <span aria-hidden>{ESTADO_GLYPH[actividad.estado]}</span>{ESTADO_LABEL[actividad.estado]}
              </span>
              <span className="font-mono-compass text-[11px] text-muted-foreground">{capitalizarPrimera(formatFechaLarga(actividad.inicio_programado))}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted">
            <X className="size-3.5" />
          </button>
        </div>

        <div className="flex flex-col gap-3 rounded-xl bg-[var(--surface-sunken)] px-4 py-3.5">
          <div className="flex items-baseline justify-between">
            <span className="font-mono-compass text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Programado</span>
            <span className="font-mono-compass text-sm text-foreground">{formatHora24(actividad.inicio_programado)}–{formatHora24(actividad.fin_programado)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono-compass text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Duración</span>
            <span className="font-mono-compass text-[13px] text-foreground/80">{formatDuracionMin(duracionProgramada)}</span>
          </div>
          {actividad.minutos_efectivos != null && (
            <div className="flex items-baseline justify-between border-t border-dashed border-border pt-3">
              <span className="font-mono-compass text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Tiempo efectivo</span>
              <span className="font-mono-compass text-[13px] text-foreground">{formatDuracionMin(actividad.minutos_efectivos)}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="font-mono-compass text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Cadena</span>
          <div className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: color }} aria-hidden />
            <span className="text-sm font-semibold text-foreground">{actividad.frente_nombre ?? "Sin Frente"}</span>
          </div>
          <div className="ml-1 flex flex-col gap-1 border-l border-border pl-4">
            <span className="text-[13.5px] text-foreground/80">{actividad.tarea_titulo ?? "Sin Tarea vinculada"}</span>
            <span className="font-mono-compass text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Tarea vinculada</span>
          </div>
        </div>

        {actividad.resultado && (
          <div className="flex flex-col gap-1.5">
            <span className="font-mono-compass text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Resultado</span>
            <p className="text-[13.5px] leading-relaxed text-pretty text-foreground/85">{actividad.resultado}</p>
          </div>
        )}

        {(origen || derivada) && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-border bg-[var(--surface-sunken)]/60 px-4 py-3.5">
            <span className="font-mono-compass text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Historial</span>
            {origen && (
              <p className="text-[13px] leading-relaxed text-foreground/80">
                Esta actividad se creó como {actividad.tipo_origen === "reprogramacion" ? "reprogramación" : "continuación"} de «{origen.titulo}» ({formatHora24(origen.inicio_programado)}, {capitalizarPrimera(formatFechaLarga(origen.inicio_programado))}), que se conserva como registro histórico.
              </p>
            )}
            {derivada && (
              <p className="text-[13px] leading-relaxed text-foreground/80">
                Esta actividad se conserva como registro; su {derivada.tipo_origen === "reprogramacion" ? "reprogramación" : "continuación"} quedó en «{derivada.titulo}» ({formatHora24(derivada.inicio_programado)}, {capitalizarPrimera(formatFechaLarga(derivada.inicio_programado))}).
              </p>
            )}
          </div>
        )}

        <div className={cn("flex flex-col gap-2.5 border-t border-border pt-4", !programada && "gap-2")}>
          <div className="flex gap-2.5">
            {programada && (
              <button type="button" onClick={onEditar} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-border text-[13px] font-semibold text-foreground hover:bg-muted">
                <Pencil className="size-3.5" />Editar
              </button>
            )}
            <button type="button" onClick={onEliminar} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-destructive/30 text-[13px] font-semibold text-destructive hover:bg-destructive/5">
              <Trash2 className="size-3.5" />Eliminar
            </button>
          </div>
          {programada ? (
            <>
              <button
                type="button"
                onClick={() => onGestionar("cerrar")}
                className="h-[42px] rounded-xl border border-foreground bg-foreground text-[13.5px] font-semibold text-background"
              >
                Cerrar actividad
              </button>
              <div className="flex gap-2.5">
                <button type="button" onClick={() => onGestionar("reprogramar")} className="h-10 flex-1 rounded-xl border border-border text-[13px] font-semibold text-foreground hover:bg-muted">
                  Reprogramar
                </button>
                <button type="button" onClick={() => onGestionar("siguiente")} className="h-10 flex-1 rounded-xl border border-border text-[13px] font-semibold text-foreground hover:bg-muted">
                  Programar siguiente
                </button>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => onGestionar("siguiente")} className="h-10 rounded-xl border border-border text-[13px] font-semibold text-foreground hover:bg-muted">
              Programar actividad siguiente
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
