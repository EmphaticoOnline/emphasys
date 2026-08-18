"use client"

import { congruenciaColorVar, sugerirCongruencia } from "@/lib/congruencia"
import { getHistorialDeFrente } from "@/lib/data"

const ALTURA_MAX = 64

export function EvolucionAtencion({ frenteId }: { frenteId: string }) {
  const historial = getHistorialDeFrente(frenteId)
  const maxHoras = Math.max(...historial.map((h) => h.medicion?.horasEfectivas ?? 0), 1)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-2 rounded-2xl border border-border bg-card px-5 py-4">
        {historial.map(({ semana, intencion, medicion }) => {
          const estado = sugerirCongruencia(intencion, medicion)
          const horas = medicion?.horasEfectivas ?? 0
          const altura = Math.max((horas / maxHoras) * ALTURA_MAX, 4)
          return (
            <div key={semana.id} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[11px] text-muted-foreground">{horas ? `${horas}h` : "—"}</span>
              <div className="flex h-16 w-full items-end justify-center">
                <div
                  className="w-6 rounded-full transition-all"
                  style={{ height: altura, backgroundColor: congruenciaColorVar[estado] }}
                  title={`${semana.etiqueta}: ${horas}h`}
                />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">{semana.etiquetaCorta}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

