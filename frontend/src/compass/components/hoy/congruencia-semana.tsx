"use client"
import { useEffect, useMemo, useState } from "react"
import { colorVarDeFrente } from "@/lib/frente-color"
import { inicioDeSemana } from "@/lib/calendario-fechas"
import { formatHorasCompacto } from "@/lib/format"
import { getRevisionSemanal, type Congruencia, type Frente, type RevisionFrente } from "../../../services/compassService"

const estadoInfo: Record<Congruencia, { label: string; var: string }> = {
  congruente: { label: "Congruente", var: "--congruent" },
  en_riesgo: { label: "En riesgo", var: "--at-risk" },
  descuidado: { label: "Descuidado", var: "--neglected" },
  sobreatendido: { label: "Sobreatendido", var: "--overattended" },
}

export function CongruenciaSemana({ dia, frentes, frenteIdsHoy }: { dia: string; frentes: Frente[]; frenteIdsHoy: Set<number> }) {
  const [datos, setDatos] = useState<RevisionFrente[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelado = false
    getRevisionSemanal(inicioDeSemana(dia))
      .then((r) => { if (!cancelado) setDatos(r.frentes) })
      .catch(() => { if (!cancelado) setError(true) })
    return () => { cancelado = true }
  }, [dia])

  const ordenados = useMemo(() => {
    if (!datos) return null
    return [...datos].sort((a, b) => Number(frenteIdsHoy.has(b.frente_id)) - Number(frenteIdsHoy.has(a.frente_id)))
  }, [datos, frenteIdsHoy])

  if (error || (ordenados && ordenados.length === 0)) return null

  return (
    <div className="mt-5 rounded-2xl bg-[var(--surface-sunken)] px-4 py-4 md:px-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono-compass text-[13px] font-semibold tracking-[0.12em] text-foreground/80">CONGRUENCIA DE LA SEMANA</h2>
        {frenteIdsHoy.size > 0 && (
          <span className="text-xs text-muted-foreground">{frenteIdsHoy.size} Frente{frenteIdsHoy.size === 1 ? "" : "s"} con actividad hoy</span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {!ordenados
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 min-w-0 animate-pulse rounded-xl bg-[var(--surface-raised)]" />
            ))
          : ordenados.map((f) => {
              const estado = f.congruencia_confirmada ?? f.congruencia_sugerida
              const info = estado ? estadoInfo[estado] : null
              const colorVar = colorVarDeFrente(frentes, f.frente_id)
              const tieneObjetivo = f.horas_objetivo_snapshot != null && f.horas_objetivo_snapshot > 0
              const horasCubiertas = f.horas_efectivas + f.horas_reservadas
              const ratio = tieneObjetivo ? Math.min(1, horasCubiertas / f.horas_objetivo_snapshot!) : null
              const tocadoHoy = frenteIdsHoy.has(f.frente_id)
              return (
                <div
                  key={f.frente_id}
                  className="flex min-w-0 flex-col gap-1.5 rounded-xl px-3 py-2.5"
                  style={{
                    background: `color-mix(in oklch, ${colorVar}, transparent 88%)`,
                    boxShadow: tocadoHoy ? `inset 3px 0 0 ${colorVar}` : undefined,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: colorVar }} />
                    <span className="min-w-0 break-words text-[13px] leading-tight font-semibold text-foreground">{f.nombre}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-editorial text-xl leading-none text-foreground">{formatHorasCompacto(horasCubiertas)}</span>
                    {tieneObjetivo && <span className="font-mono-compass text-[11px] text-muted-foreground">/ {formatHorasCompacto(f.horas_objetivo_snapshot!)}</span>}
                  </div>
                  {(tieneObjetivo || f.horas_efectivas > 0 || f.horas_reservadas > 0) && (
                    <span className="text-[10.5px] leading-tight text-muted-foreground">
                      {formatHorasCompacto(f.horas_efectivas)} ejecutadas · {formatHorasCompacto(f.horas_reservadas)} reservadas
                    </span>
                  )}
                  <div className="h-1 overflow-hidden rounded-full bg-foreground/10">
                    {ratio != null && info && <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: `var(${info.var})` }} />}
                  </div>
                  <span className="font-mono-compass text-[10px] font-semibold tracking-[0.06em]" style={{ color: info ? `var(${info.var})` : "var(--muted-foreground)" }}>
                    {info ? info.label.toUpperCase() : "SIN DATOS"}
                  </span>
                </div>
              )
            })}
      </div>
    </div>
  )
}
