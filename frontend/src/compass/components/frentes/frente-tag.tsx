"use client"

import { Link } from "react-router-dom"
import { useCompass } from "@/lib/store"
import { cn } from "@/lib/utils"

export function FrenteTag({ frenteId, muted = false }: { frenteId?: string; muted?: boolean }) {
  const { frentes } = useCompass()
  if (!frenteId) return null
  const frente = frentes.find((f) => f.id === frenteId)
  if (!frente) return null

  return (
    <Link
      to={`/compass/frentes/${frente.id}`}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        muted ? "text-muted-foreground" : "text-foreground",
      )}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: `var(--${frente.color})` }}
        aria-hidden
      />
      {frente.nombre}
    </Link>
  )
}
