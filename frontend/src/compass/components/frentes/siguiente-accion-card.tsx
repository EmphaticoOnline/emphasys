"use client"

import { useState } from "react"
import { Check, Compass, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useCompass } from "@/lib/store"
import type { Frente } from "@/lib/types"

export function SiguienteAccionCard({ frente }: { frente: Frente }) {
  const { actualizarSiguienteAccion } = useCompass()
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(frente.siguienteAccion)

  function guardar() {
    if (texto.trim()) {
      actualizarSiguienteAccion(frente.id, texto.trim())
    }
    setEditando(false)
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/[0.04] px-5 py-4">
      <div className="flex items-center gap-2 text-primary">
        <Compass className="size-3.5" />
        <h2 className="font-heading text-sm">Siguiente acción</h2>
      </div>

      {editando ? (
        <div className="flex flex-col gap-2.5">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="min-h-16 resize-none bg-background"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={guardar}>
              <Check data-icon="inline-start" />
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setTexto(frente.siguienteAccion); setEditando(false) }}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm leading-relaxed text-foreground">{frente.siguienteAccion}</p>
          <button
            type="button"
            onClick={() => setEditando(true)}
            aria-label="Editar siguiente acción"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
        </div>
      )}
    </section>
  )
}
