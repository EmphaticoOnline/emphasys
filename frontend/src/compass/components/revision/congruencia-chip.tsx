"use client"
import { cn } from "@/lib/utils"
import type { Congruencia } from "../../../services/compassService"
import { congruenciaLabel, congruenciaToken } from "./revision-labels"

const ESTADOS: Congruencia[] = ["congruente", "en_riesgo", "descuidado", "sobreatendido"]

export function SugeridaBadge({ estado }: { estado: Congruencia | null }) {
  if (!estado) return <span className="text-xs text-muted-foreground">Sin sugerencia</span>
  const token = congruenciaToken[estado]
  return (
    <span
      className="rounded-md border border-dashed px-2 py-0.5 text-xs font-medium"
      style={{
        color: `var(${token})`,
        borderColor: `color-mix(in oklch, var(${token}), transparent 45%)`,
        background: `color-mix(in oklch, var(${token}), transparent 90%)`,
      }}
    >
      {congruenciaLabel[estado]}
    </span>
  )
}

export function ConfirmacionChips({ valor, onChange }: { valor: Congruencia | ""; onChange: (v: Congruencia | "") => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ESTADOS.map((estado) => {
        const activo = valor === estado
        const token = congruenciaToken[estado]
        return (
          <button
            key={estado}
            type="button"
            onClick={() => onChange(activo ? "" : estado)}
            className={cn(
              "min-h-9 rounded-md border px-2.5 text-xs font-medium transition-colors",
              activo ? "border-transparent" : "border-border text-muted-foreground hover:text-foreground",
            )}
            style={activo ? { background: `color-mix(in oklch, var(${token}), transparent 85%)`, color: `var(${token})` } : undefined}
          >
            {congruenciaLabel[estado]}
          </button>
        )
      })}
    </div>
  )
}
