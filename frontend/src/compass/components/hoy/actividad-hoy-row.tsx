"use client"
import { useEffect, useState } from "react"
import { CheckCircle2, CircleDashed, CircleSlash, XCircle } from "lucide-react"
import { colorVarDeFrente } from "@/lib/frente-color"
import { formatHora24, formatDuracionMin } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Actividad, Frente } from "../../../services/compassService"

const cierreInfo = {
  realizada: { icon: CheckCircle2, var: "--congruent" },
  parcial: { icon: CircleDashed, var: "--at-risk" },
  no_realizada: { icon: XCircle, var: "--neglected" },
  cancelada: { icon: CircleSlash, var: "--muted-foreground" },
} as const

export function ActividadHoyRow({ actividad, frentes, onSelect }: { actividad: Actividad; frentes: Frente[]; onSelect: (a: Actividad) => void }) {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const colorVar = colorVarDeFrente(frentes, actividad.frente_id)
  const inicio = new Date(actividad.inicio_programado)
  const fin = new Date(actividad.fin_programado)
  const cerrada = actividad.estado !== "programada"
  const enCurso = !cerrada && ahora >= inicio && ahora < fin
  const rangoHorario = `${formatHora24(actividad.inicio_programado)}–${formatHora24(actividad.fin_programado)}`

  if (enCurso) {
    const totalMs = fin.getTime() - inicio.getTime()
    const transcurridoMs = ahora.getTime() - inicio.getTime()
    const fraccion = totalMs > 0 ? Math.min(1, Math.max(0, transcurridoMs / totalMs)) : 0
    const restanMin = Math.max(0, Math.round((fin.getTime() - ahora.getTime()) / 60000))
    const frente = frentes.find((f) => f.id === actividad.frente_id)
    return (
      <button
        type="button"
        onClick={() => onSelect(actividad)}
        className="my-1 grid grid-cols-[96px_1fr] items-center gap-3 rounded-2xl px-4 py-2.5 text-left"
        style={{ background: `color-mix(in oklch, ${colorVar}, transparent 87%)`, boxShadow: `inset 4px 0 0 ${colorVar}` }}
      >
        <span className="whitespace-nowrap font-mono-compass text-xs tabular-nums text-foreground/90">{rangoHorario}</span>
        <span className="flex flex-col gap-1.5">
          <span className="flex items-center gap-2.5">
            <span className="font-mono-compass text-[11px] font-semibold tracking-[0.1em]" style={{ color: colorVar }}>EN CURSO</span>
            <span className="h-px flex-1" style={{ background: `color-mix(in oklch, ${colorVar}, transparent 75%)` }} />
            <span className="font-mono-compass text-[11px] text-muted-foreground">quedan {formatDuracionMin(restanMin)}</span>
          </span>
          <span className="font-heading text-lg font-semibold text-foreground">{actividad.titulo}</span>
          {frente && <span className="text-xs font-medium" style={{ color: colorVar }}>{frente.nombre}</span>}
          <span className="mt-0.5 h-1 overflow-hidden rounded-full" style={{ background: `color-mix(in oklch, ${colorVar}, transparent 78%)` }}>
            <span className="block h-full rounded-full" style={{ width: `${fraccion * 100}%`, background: colorVar }} />
          </span>
        </span>
      </button>
    )
  }

  const cierre = cerrada ? cierreInfo[actividad.estado as keyof typeof cierreInfo] : null
  const faltan = !cerrada && inicio > ahora ? Math.round((inicio.getTime() - ahora.getTime()) / 60000) : null

  return (
    <button
      type="button"
      onClick={() => onSelect(actividad)}
      className={cn(
        "group grid grid-cols-[96px_4px_1fr_auto] items-center gap-3 rounded-xl px-3 py-1.5 text-left transition-colors hover:bg-accent/40",
        cerrada && "opacity-60",
      )}
    >
      <span className="whitespace-nowrap font-mono-compass text-xs tabular-nums text-muted-foreground">{rangoHorario}</span>
      <span className="h-full min-h-8 self-stretch rounded-full" style={{ background: colorVar }} />
      <span className="flex flex-col gap-0.5">
        <span className={cn("text-sm font-semibold text-foreground", cerrada && "line-through decoration-foreground/30")}>{actividad.titulo}</span>
        {actividad.frente_nombre && <span className="text-xs font-medium" style={{ color: colorVar }}>{actividad.frente_nombre}</span>}
      </span>
      {cierre ? (
        <cierre.icon className="size-4" style={{ color: `var(${cierre.var})` }} />
      ) : faltan != null ? (
        <span className="font-mono-compass text-[11px] text-muted-foreground">EN {formatDuracionMin(faltan)}</span>
      ) : (
        <span className="font-mono-compass text-[11px] text-muted-foreground">por cerrar</span>
      )}
    </button>
  )
}
