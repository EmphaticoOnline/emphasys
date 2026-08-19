"use client"

import { useRef, useState } from "react"
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
  onDragBegin,
  onDragFinish,
}: {
  actividad: Actividad
  frentes: Frente[]
  top: number
  height: number
  leftPct: number
  widthPct: number
  onSelect: (a: Actividad) => void
  onResize: (a: Actividad, edge: "inicio" | "fin", deltaMinutes: number) => void
  onDragBegin: (a: Actividad, grabOffsetY: number) => void
  onDragFinish: () => void
}) {
  const color = colorVarDeFrente(frentes, actividad.frente_id)
  const deco = decoracionEstado(actividad.estado, color)
  const esDerivada = Boolean(actividad.tipo_origen)

  const mostrarFrente = height >= 58
  const mostrarTarea = mostrarFrente && height >= 82 && Boolean(actividad.tarea_titulo)
  const mostrarDeriv = height >= 104 && (esDerivada || actividad.estado !== "programada")
  const resizeActivo = useRef(false)
  const [resizePreview, setResizePreview] = useState<{ edge: "inicio" | "fin"; delta: number } | null>(null)

  const horaPreview = (edge: "inicio" | "fin", delta: number) => {
    const base = edge === "inicio" ? actividad.inicio_programado : actividad.fin_programado
    return formatHora24(new Date(new Date(base).getTime() + delta * 60_000).toISOString())
  }

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={actividad.estado === "programada"}
      onDragStart={(event) => {
        if (resizeActivo.current) { event.preventDefault(); return }
        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData("application/x-compass-actividad", String(actividad.id))
        const grabOffsetY = event.clientY - event.currentTarget.getBoundingClientRect().top
        onDragBegin(actividad, grabOffsetY)
      }}
      onDragEnd={onDragFinish}
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
          <ResizeHandle edge="inicio" onActiveChange={(active) => { resizeActivo.current = active; if (!active) setResizePreview(null) }} onPreview={(delta) => setResizePreview({ edge: "inicio", delta })} onResize={(delta) => onResize(actividad, "inicio", delta)} />
          <ResizeHandle edge="fin" onActiveChange={(active) => { resizeActivo.current = active; if (!active) setResizePreview(null) }} onPreview={(delta) => setResizePreview({ edge: "fin", delta })} onResize={(delta) => onResize(actividad, "fin", delta)} />
        </>
      )}
      {resizePreview && (
        <span className={cn("pointer-events-none absolute right-1 z-20 rounded-md bg-foreground px-1.5 py-0.5 font-mono-compass text-[9px] text-background shadow-sm", resizePreview.edge === "inicio" ? "top-2.5" : "bottom-2.5")}>
          {horaPreview(resizePreview.edge, resizePreview.delta)}
        </span>
      )}
    </div>
  )
}

function ResizeHandle({ edge, onResize, onPreview, onActiveChange }: { edge: "inicio" | "fin"; onResize: (deltaMinutes: number) => void; onPreview: (deltaMinutes: number) => void; onActiveChange: (active: boolean) => void }) {
  const startY = useRef<number | null>(null)
  const lastDelta = useRef(0)
  const snapDelta = (clientY: number) => Math.round((((clientY - (startY.current ?? clientY)) / 56) * 60) / 15) * 15

  return (
    <button
      type="button"
      aria-label={edge === "inicio" ? "Cambiar hora de inicio" : "Cambiar hora de finalización"}
      draggable={false}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
        startY.current = event.clientY
        lastDelta.current = 0
        onActiveChange(true)
        onPreview(0)
      }}
      onPointerMove={(event) => {
        if (startY.current == null) return
        const delta = snapDelta(event.clientY)
        lastDelta.current = delta
        onPreview(delta)
      }}
      onPointerUp={(event) => {
        if (startY.current == null) return
        event.preventDefault()
        event.stopPropagation()
        const delta = lastDelta.current
        startY.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
        onActiveChange(false)
        if (delta !== 0) onResize(delta)
      }}
      onPointerCancel={() => { startY.current = null; onActiveChange(false) }}
      className={cn("group absolute inset-x-1 z-20 flex h-2.5 touch-none cursor-ns-resize items-center justify-center", edge === "inicio" ? "top-0" : "bottom-0")}
    >
      <span className="h-0.5 w-8 rounded-full bg-foreground/0 transition-colors group-hover:bg-foreground/35 group-focus-visible:bg-foreground/35" />
    </button>
  )
}
