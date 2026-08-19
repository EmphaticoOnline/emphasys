"use client"
import { useEffect, useMemo, useState } from "react"
import { colorVarDeFrente } from "@/lib/frente-color"
import { horaYMinuto, formatDuracionMin } from "@/lib/format"
import type { Actividad, Frente } from "../../../services/compassService"

const VENTANA_INICIO = 6
const VENTANA_FIN = 23
const VENTANA_HORAS = VENTANA_FIN - VENTANA_INICIO
const MARCAS = [6, 9, 12, 15, 18, 21, 23]

function horaFraccional(iso: string) {
  const { hora, minuto } = horaYMinuto(iso)
  return hora + minuto / 60
}

function posicion(inicioFrac: number, finFrac: number) {
  const inicio = Math.max(VENTANA_INICIO, Math.min(VENTANA_FIN, inicioFrac))
  const fin = Math.max(VENTANA_INICIO, Math.min(VENTANA_FIN, finFrac))
  const left = ((inicio - VENTANA_INICIO) / VENTANA_HORAS) * 100
  const width = Math.max(((fin - inicio) / VENTANA_HORAS) * 100, 0.6)
  return { left, width }
}

export function ArcoDelDia({ actividades, frentes }: { actividades: Actividad[]; frentes: Frente[] }) {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const ahoraLocal = horaYMinuto(ahora.toISOString())
  const ahoraFrac = ahoraLocal.hora + ahoraLocal.minuto / 60
  const ahoraVisible = ahoraFrac >= VENTANA_INICIO && ahoraFrac <= VENTANA_FIN
  const ahoraLeft = ((Math.max(VENTANA_INICIO, Math.min(VENTANA_FIN, ahoraFrac)) - VENTANA_INICIO) / VENTANA_HORAS) * 100

  const segmentos = useMemo(
    () =>
      actividades
        .filter((a) => a.estado !== "cancelada")
        .map((a) => {
          const inicioFrac = horaFraccional(a.inicio_programado)
          const finFrac = horaFraccional(a.fin_programado)
          if (finFrac <= VENTANA_INICIO || inicioFrac >= VENTANA_FIN) return null
          const enCurso = a.estado === "programada" && ahoraFrac >= inicioFrac && ahoraFrac < finFrac
          return { actividad: a, ...posicion(inicioFrac, finFrac), enCurso }
        })
        .filter((s): s is NonNullable<typeof s> => s !== null),
    [actividades, ahoraFrac],
  )

  const proxima = useMemo(
    () =>
      actividades
        .filter((a) => a.estado === "programada" && new Date(a.inicio_programado).getTime() > ahora.getTime())
        .sort((a, b) => new Date(a.inicio_programado).getTime() - new Date(b.inicio_programado).getTime())[0],
    [actividades, ahora],
  )
  const minutosLibres = proxima
    ? Math.max(0, Math.round((new Date(proxima.inicio_programado).getTime() - ahora.getTime()) / 60000))
    : null

  return (
    <div className="mt-4 flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="font-mono-compass text-[11px] font-semibold tracking-[0.12em] text-muted-foreground">ARCO DEL DÍA</span>
        {minutosLibres != null && (
          <span className="text-xs text-muted-foreground">{formatDuracionMin(minutosLibres)} libres antes de la próxima actividad</span>
        )}
      </div>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-2 h-2.5 rounded-full bg-[var(--surface-raised)]" />
        {segmentos.map(({ actividad, left, width, enCurso }) => (
          <div
            key={actividad.id}
            className="absolute rounded-full"
            style={{
              left: `${left}%`,
              width: `${width}%`,
              top: enCurso ? "5px" : "8px",
              height: enCurso ? "16px" : "10px",
              background: colorVarDeFrente(frentes, actividad.frente_id),
              boxShadow: enCurso ? `0 0 0 3px color-mix(in oklch, ${colorVarDeFrente(frentes, actividad.frente_id)}, transparent 84%)` : undefined,
            }}
            title={actividad.titulo}
          />
        ))}
        {ahoraVisible && (
          <>
            <div className="absolute inset-y-0 w-0.5 rounded-full bg-foreground" style={{ left: `${ahoraLeft}%` }} />
            <div
              className="animate-now-pulse absolute top-0 size-2 -translate-x-1/2 -translate-y-0.5 rounded-full bg-foreground"
              style={{ left: `${ahoraLeft}%` }}
            />
          </>
        )}
      </div>
      <div className="flex justify-between font-mono-compass text-[10px] text-muted-foreground">
        {MARCAS.map((h) => (
          <span key={h}>{String(h).padStart(2, "0")}</span>
        ))}
      </div>
    </div>
  )
}
