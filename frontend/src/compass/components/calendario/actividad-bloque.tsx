"use client"

import { colorVarDeFrente } from "@/lib/frente-color"
import { formatHora24 } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Actividad, Frente } from "../../../services/compassService"
import { ESTADO_GLYPH, decoracionEstado } from "./estado-actividad-visual"

export function ActividadBloque({
  actividad,
  frentes,
  top,
  height,
  leftPct,
  widthPct,
  onSelect,
  onResize,
}: {
  actividad: Actividad
  frentes: Frente[]
  top: number
  height: number
  leftPct: number
  widthPct: number
  onSelect: (a: Actividad) => void
  onResize: (a: Actividad, edge: "inicio" | "fin", deltaMinutes: number) => void
}) {
  const color = colorVarDeFrente(frentes, actividad.frente_id)
  const deco = decoracionEstado(actividad.estado, color)
  const esDerivada = Boolean(actividad.tipo_origen)

  const mostrarFrente = height >= 58
  const mostrarTarea = mostrarFrente && height >= 82 && Boolean(actividad.tarea_titulo)
  const mostrarDeriv = height >= 104 && (esDerivada || actividad.estado !== "programada")

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={actividad.estado === "programada"}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData("application/x-compass-actividad", String(actividad.id))
      }}
      onClick={() => onSelect(actividad)}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(actividad) } }}
      className={cn("absolute z-[3] flex flex-col overflow-hidden rounded-[11px] px-2.5 py-1.5 text-left transition-shadow hover:shadow-[0_2px_8px_rgba(60,45,25,0.12)]", actividad.estado === "programada" && "cursor-grab active:cursor-grabbing")}
      style={{
        top,
        height,
        left: `calc(${leftPct}% + 3px)`,
        width: `calc(${widthPct}% - 6px)`,
        border: deco.border,
        background: deco.background,
      }}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="font-mono-compass text-[10px] whitespace-nowrap text-muted-foreground">
          {formatHora24(actividad.inicio_programado)}–{formatHora24(actividad.fin_programado)}
        </span>
        <span className="text-[10px] leading-none text-muted-foreground" aria-hidden>{ESTADO_GLYPH[actividad.estado]}</span>
      </div>
      <span
        className={cn(
          "mt-0.5 text-[13px] leading-[16px] font-semibold text-pretty text-foreground",
          "line-clamp-2",
          deco.textoAtenuado && "text-muted-foreground",
          deco.tachado && "line-through",
        )}
      >
        {actividad.titulo}
      </span>
      {mostrarFrente && (
        <span className="mt-1 flex min-w-0 items-center gap-1.5">
          <span className="size-[7px] shrink-0 rounded-sm" style={{ background: color }} aria-hidden />
          <span className="truncate text-[11px] text-muted-foreground">{actividad.frente_nombre ?? "Sin Frente"}</span>
        </span>
      )}
      {mostrarTarea && (
        <span className="mt-0.5 truncate pl-[13px] text-[11px] text-muted-foreground/80">↳ {actividad.tarea_titulo}</span>
      )}
      {mostrarDeriv && esDerivada && (
        <span className="mt-1.5 border-t border-dashed border-border pt-1 font-mono-compass text-[9px] tracking-[0.08em] text-muted-foreground uppercase">
          {actividad.tipo_origen === "reprogramacion" ? "Reprogramada" : "Continuación"}
        </span>
      )}
      {actividad.estado === "programada" && (
        <>
          <ResizeHandle edge="inicio" onResize={(delta) => onResize(actividad, "inicio", delta)} />
          <ResizeHandle edge="fin" onResize={(delta) => onResize(actividad, "fin", delta)} />
        </>
      )}
    </div>
  )
}

function ResizeHandle({ edge, onResize }: { edge: "inicio" | "fin"; onResize: (deltaMinutes: number) => void }) {
  return (
    <button
      type="button"
      aria-label={edge === "inicio" ? "Cambiar hora de inicio" : "Cambiar hora de finalización"}
      draggable={false}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        const startY = event.clientY
        const onUp = (upEvent: PointerEvent) => {
          document.removeEventListener("pointerup", onUp)
          const rawMinutes = ((upEvent.clientY - startY) / 56) * 60
          const snapped = Math.round(rawMinutes / 15) * 15
          if (snapped !== 0) onResize(snapped)
        }
        document.addEventListener("pointerup", onUp, { once: true })
      }}
      className={cn("absolute inset-x-2 z-10 h-2 cursor-ns-resize rounded-full bg-foreground/0 hover:bg-foreground/20", edge === "inicio" ? "top-0" : "bottom-0")}
    />
  )
}
