"use client"

import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { IndicadorCongruencia } from "@/components/congruencia/indicador"
import { sugerirCongruencia } from "@/lib/congruencia"
import { useCompass } from "@/lib/store"
import type { Frente } from "@/lib/types"
import { cn } from "@/lib/utils"

const estadoLabel: Record<Frente["estado"], string> = {
  Activo: "Activo",
  Pausado: "Pausado",
  Completado: "Completado",
  Archivado: "Archivado",
}

export function FrenteCard({ frente }: { frente: Frente }) {
  const { intenciones, medicion } = useCompass()
  const intencion = intenciones.find((i) => i.frenteId === frente.id)
  const med = medicion.find((m) => m.frenteId === frente.id)
  const estado = sugerirCongruencia(intencion, med)
  const inactivo = frente.estado !== "Activo"

  return (
    <Link
      to={`/compass/frentes/${frente.id}`}
      className={cn(
        "group flex flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary/30",
        inactivo && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: `var(--${frente.color})` }}
            aria-hidden
          />
          <div>
            <p className="text-sm font-medium text-foreground">{frente.nombre}</p>
            <p className="text-xs text-muted-foreground">{frente.categoria}</p>
          </div>
        </div>
        <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{frente.proposito}</p>
      <div className="flex items-center justify-between border-t border-border pt-3">
        {frente.estado === "Activo" ? (
          <IndicadorCongruencia estado={estado} />
        ) : (
          <span className="text-xs text-muted-foreground">{estadoLabel[frente.estado]}</span>
        )}
        {intencion?.horasObjetivo ? (
          <span className="text-xs text-muted-foreground">
            {med?.horasEfectivas ?? 0}h de {intencion.horasObjetivo}h
          </span>
        ) : null}
      </div>
    </Link>
  )
}
