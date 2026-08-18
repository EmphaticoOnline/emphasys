"use client"

import { diaDelMes, nombreDiaCorto } from "@/lib/calendario-fechas"
import { horaYMinuto, horasEntre } from "@/lib/format"
import { estadoActividadBloque } from "@/components/actividad/estado-actividad"
import { useCompass } from "@/lib/store"
import type { Actividad } from "@/lib/types"
import { cn } from "@/lib/utils"

const HORA_INICIO = 6
const HORA_FIN = 21
const HORAS = Array.from({ length: HORA_FIN - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i)
const ROW_H = 48

function etiquetaHora(hora: number) {
  if (hora === 12) return "12 pm"
  if (hora === 0) return "12 am"
  return hora > 12 ? `${hora - 12} pm` : `${hora} am`
}

export function SemanaGrid({
  dias,
  hoy,
  seleccionada,
  onSlotClick,
  onActividadClick,
}: {
  dias: string[]
  hoy: string
  seleccionada: string
  onSlotClick: (dia: string, hora: number) => void
  onActividadClick: (actividad: Actividad) => void
}) {
  const { frentes, actividades } = useCompass()

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Encabezado de días */}
      <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b border-border">
        <div />
        {dias.map((dia) => {
          const esHoy = dia === hoy
          const esSeleccionada = dia === seleccionada
          return (
            <div
              key={dia}
              className={cn(
                "flex flex-col items-center gap-0.5 border-l border-border py-2.5",
                esSeleccionada && "bg-accent/50",
              )}
            >
              <span className="text-[11px] text-muted-foreground">{nombreDiaCorto(dia)}</span>
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-medium text-foreground",
                  esHoy && "bg-primary text-primary-foreground",
                )}
              >
                {diaDelMes(dia)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Cuadrícula de horas */}
      <div className="max-h-[560px] overflow-y-auto">
        <div
          className="grid grid-cols-[3.5rem_repeat(7,1fr)]"
          style={{ gridTemplateRows: `repeat(${HORAS.length}, ${ROW_H}px)` }}
        >
          {HORAS.map((h, i) => (
            <div
              key={h}
              className="pr-2 text-right text-[10px] text-muted-foreground"
              style={{ gridRow: i + 1, gridColumn: 1, transform: "translateY(-6px)" }}
            >
              {etiquetaHora(h)}
            </div>
          ))}

          {dias.map((dia, di) => {
            const actividadesDia = actividades.filter(
              (a) => a.inicio.startsWith(dia) && a.estado !== "Cancelada",
            )
            return (
              <div
                key={dia}
                className={cn("relative border-l border-border", dia === seleccionada && "bg-accent/20")}
                style={{ gridRow: `1 / span ${HORAS.length}`, gridColumn: di + 2 }}
              >
                {HORAS.map((h, i) => (
                  <button
                    key={h}
                    type="button"
                    aria-label={`Agendar el ${dia} a las ${etiquetaHora(h)}`}
                    className="absolute inset-x-0 border-t border-border/60 transition-colors hover:bg-accent/40"
                    style={{ top: i * ROW_H, height: ROW_H }}
                    onClick={() => onSlotClick(dia, h)}
                  />
                ))}

                {actividadesDia.map((a) => {
                  const { hora, minuto } = horaYMinuto(a.inicio)
                  const horas = Math.max(horasEntre(a.inicio, a.fin), 0.25)
                  const top = (hora - HORA_INICIO) * ROW_H + (minuto / 60) * ROW_H
                  const height = Math.max(horas * ROW_H - 2, 20)
                  const frente = frentes.find((f) => f.id === a.frenteId)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onActividadClick(a)
                      }}
                      className={cn(
                        "absolute inset-x-0.5 z-10 flex flex-col overflow-hidden rounded-md px-1.5 py-1 text-left text-foreground",
                        estadoActividadBloque[a.estado],
                      )}
                      style={{
                        top: Math.max(top, 0),
                        height,
                        borderLeftWidth: 3,
                        borderLeftColor: frente ? `var(--${frente.color})` : "var(--border)",
                        borderLeftStyle: "solid",
                      }}
                    >
                      <span className="truncate text-[11px] font-medium leading-tight">{a.titulo}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
