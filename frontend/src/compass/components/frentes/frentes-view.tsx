"use client"

import { useMemo, useState } from "react"
import { FrenteCard } from "@/components/frentes/frente-card"
import { Badge } from "@/components/ui/badge"
import { useCompass } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { Categoria } from "@/lib/types"

const filtros: { label: string; value: Categoria | "Todos" }[] = [
  { label: "Todos", value: "Todos" },
  { label: "Profesional", value: "Profesional" },
  { label: "Personal", value: "Personal" },
]

export function FrentesView() {
  const { frentes } = useCompass()
  const [filtro, setFiltro] = useState<Categoria | "Todos">("Todos")

  const visibles = useMemo(
    () => frentes.filter((f) => filtro === "Todos" || f.categoria === filtro),
    [frentes, filtro],
  )

  const activos = visibles.filter((f) => f.estado === "Activo")
  const otros = visibles.filter((f) => f.estado !== "Activo")

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl tracking-tight text-foreground">Frentes</h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Los frentes son las áreas de tu vida a las que decidiste prestar atención. No son tareas — son direcciones.
        </p>
      </header>

      <div className="flex items-center gap-2">
        {filtros.map((f) => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              filtro === f.value
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        {activos.map((frente) => (
          <FrenteCard key={frente.id} frente={frente} />
        ))}
      </section>

      {otros.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-sm text-muted-foreground">Sin actividad reciente</h2>
            <Badge variant="secondary">{otros.length}</Badge>
          </div>
          {otros.map((frente) => (
            <FrenteCard key={frente.id} frente={frente} />
          ))}
        </section>
      )}
    </div>
  )
}
