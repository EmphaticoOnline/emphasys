"use client"

import { Plus } from "lucide-react"
import { ActividadRow } from "@/components/actividad/actividad-row"
import { useCompass } from "@/lib/store"
import type { Actividad } from "@/lib/types"

export function AgendaDia({
  fecha,
  onSelectActividad,
  onCrear,
}: {
  fecha: string
  onSelectActividad: (actividad: Actividad) => void
  onCrear: () => void
}) {
  const { actividades } = useCompass()

  const actividadesDia = actividades
    .filter((a) => a.inicio.startsWith(fecha) && a.estado !== "Cancelada")
    .sort((a, b) => (a.inicio < b.inicio ? -1 : 1))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col rounded-2xl border border-border bg-card">
        {actividadesDia.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No hay actividades registradas este día.</p>
        ) : (
          actividadesDia.map((a, i) => (
            <div key={a.id} className={i !== 0 ? "border-t border-border" : ""}>
              <ActividadRow actividad={a} onSelect={onSelectActividad} />
            </div>
          ))
        )}
      </div>
      <button
        type="button"
        onClick={onCrear}
        className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
      >
        <Plus className="size-4" />
        Agendar actividad
      </button>
    </div>
  )
}
