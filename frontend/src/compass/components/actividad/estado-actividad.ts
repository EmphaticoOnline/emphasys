import { CheckCircle2, CircleDashed, CircleSlash, Clock, XCircle } from "lucide-react"
import type { EstadoActividad } from "@/lib/types"

export const estadoActividadIcono: Record<EstadoActividad, typeof CheckCircle2> = {
  Programada: Clock,
  Realizada: CheckCircle2,
  Parcial: CircleDashed,
  "No realizada": XCircle,
  Cancelada: CircleSlash,
}

/** Clases discretas para distinguir el estado de una actividad en un bloque del calendario. */
export const estadoActividadBloque: Record<EstadoActividad, string> = {
  Programada: "border border-dashed border-current/50 bg-card",
  Realizada: "border border-transparent bg-[var(--congruent)]/12",
  Parcial: "border border-dashed border-[var(--at-risk)]/50 bg-[var(--at-risk)]/10",
  "No realizada": "border border-transparent bg-muted opacity-60",
  Cancelada: "border border-transparent bg-transparent opacity-40 line-through",
}
