"use client"
import { Button } from "@/components/ui/button"
import { colorVarDeFrente } from "@/lib/frente-color"
import type { ExpectativaAtencion, Frente, IntencionPrioridad, RevisionFrente } from "../../../services/compassService"
import { expectativaLabel, prioridadLabel } from "./revision-labels"

export type SiguienteIntencion = {
  prioridad: IntencionPrioridad
  mode: "horas" | "expectativa"
  horas: string
  expectativa: ExpectativaAtencion
}

const PASO_HORAS = 0.25

export function IntencionSiguienteCard({
  frente,
  frentesOrdenados,
  valor,
  onChange,
}: {
  frente: RevisionFrente
  frentesOrdenados: Frente[]
  valor: SiguienteIntencion
  onChange: (patch: Partial<SiguienteIntencion>) => void
}) {
  const color = colorVarDeFrente(frentesOrdenados, frente.frente_id)

  return (
    <article className="rounded-2xl border border-border bg-card px-5 py-5">
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
        <h3 className="text-sm font-semibold">{frente.nombre}</h3>
        <div className="flex-1" />
        <div className="flex gap-1 rounded-lg bg-[var(--surface-sunken)] p-1">
          {(["horas", "expectativa"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChange({ mode })}
              className={`min-h-9 rounded-md px-3 font-mono-compass text-[10px] tracking-[0.06em] uppercase transition-colors ${
                valor.mode === mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {mode === "horas" ? "Horas objetivo" : "Cualitativa"}
            </button>
          ))}
        </div>
      </div>

      {valor.mode === "horas" ? (
        <div className="grid gap-5 sm:grid-cols-2 sm:items-end">
          <div>
            <p className="mb-2 font-mono-compass text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Prioridad semanal</p>
            <div className="flex gap-1.5">
              {(["alta", "media", "baja"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onChange({ prioridad: p })}
                  className={`min-h-10 rounded-md border px-3 text-[13px] font-medium ${
                    valor.prioridad === p ? "border-transparent bg-[var(--surface-sunken)] text-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  {prioridadLabel[p]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 font-mono-compass text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Horas objetivo</p>
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Restar 15 minutos"
                onClick={() => onChange({ horas: String(Math.max(PASO_HORAS, Number(valor.horas || "0") - PASO_HORAS)) })}
              >
                −
              </Button>
              <span className="min-w-14 text-center font-mono-compass text-xl">{valor.horas || 0} h</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Sumar 15 minutos"
                onClick={() => onChange({ horas: String(Number(valor.horas || "0") + PASO_HORAS) })}
              >
                +
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-2 font-mono-compass text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Expectativa de atención</p>
          <div className="flex flex-wrap gap-1.5">
            {(["sin_compromiso", "atender", "prioritario"] as const).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onChange({ expectativa: e })}
                className={`min-h-10 rounded-md border px-3 text-[13px] font-medium ${
                  valor.expectativa === e ? "border-transparent bg-[var(--surface-sunken)] text-foreground" : "border-border text-muted-foreground"
                }`}
              >
                {expectativaLabel[e]}
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-xs text-muted-foreground italic">Sin horas objetivo: este Frente no se evaluará por tiempo.</p>
        </div>
      )}
    </article>
  )
}
