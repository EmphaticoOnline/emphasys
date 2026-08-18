import { congruenciaColorVar, congruenciaLabel } from "@/lib/congruencia"
import type { EstadoCongruencia } from "@/lib/types"
import { cn } from "@/lib/utils"

export function IndicadorCongruencia({
  estado,
  showLabel = true,
  className,
}: {
  estado: EstadoCongruencia
  showLabel?: boolean
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: congruenciaColorVar[estado] }}
        aria-hidden
      />
      {showLabel && congruenciaLabel[estado]}
    </span>
  )
}
