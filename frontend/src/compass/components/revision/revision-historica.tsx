"use client"
import { colorVarDeFrente } from "@/lib/frente-color"
import { formatFechaHora, formatHorasCompacto } from "@/lib/format"
import type { Frente, RevisionSemanal } from "../../../services/compassService"
import { congruenciaLabel, congruenciaToken, expectativaLabel, prioridadLabel } from "./revision-labels"

export function RevisionHistorica({
  data,
  frentesOrdenados,
  rangoSemana,
}: {
  data: RevisionSemanal
  frentesOrdenados: Frente[]
  rangoSemana: string
}) {
  const revision = data.revision
  if (!revision) return null

  const preguntas = [
    { pregunta: "¿Qué recibió la atención que esperabas?", respuesta: revision.atencion_esperada },
    { pregunta: "¿Qué quedó descuidado?", respuesta: revision.frentes_descuidados },
    { pregunta: "¿Qué aprendiste de esta semana?", respuesta: revision.aprendizaje_principal },
    { pregunta: "¿Qué cambia para la siguiente semana?", respuesta: revision.ajuste_general },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-[var(--surface-sunken)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-[var(--surface-raised)] px-6 py-3.5">
        <span className="font-mono-compass text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Snapshot · revisión cerrada</span>
        <span className="h-3 w-px bg-border" />
        <span className="font-mono-compass text-[10px] text-muted-foreground">{formatFechaHora(revision.fecha_revision)} · valores congelados, no se recalculan</span>
      </div>

      <div className="px-6 py-9 md:px-8">
        <p className="mb-3.5 font-mono-compass text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Memoria de la semana</p>
        <h2 className="mb-8 font-editorial text-[34px] leading-tight">{rangoSemana}</h2>

        <div className="flex flex-col">
          {data.frentes.map((f) => {
            const color = colorVarDeFrente(frentesOrdenados, f.frente_id)
            return (
              <div key={f.frente_id} className="border-t border-border py-6 first:border-0">
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
                  <h3 className="text-[15px] font-semibold">{f.nombre}</h3>
                </div>
                <div className="grid gap-5 md:grid-cols-3">
                  <div>
                    <p className="mb-2 font-mono-compass text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Intención que existía</p>
                    {f.horas_objetivo_snapshot != null ? (
                      <>
                        <p className="font-editorial text-lg">{formatHorasCompacto(f.horas_objetivo_snapshot)} objetivo</p>
                        {f.prioridad_snapshot && (
                          <p className="mt-1 font-mono-compass text-[11px] text-muted-foreground">Prioridad {prioridadLabel[f.prioridad_snapshot]}</p>
                        )}
                      </>
                    ) : f.expectativa_atencion_snapshot != null ? (
                      <>
                        <p className="font-editorial text-lg">{expectativaLabel[f.expectativa_atencion_snapshot]}</p>
                        <p className="mt-1 font-mono-compass text-[11px] text-muted-foreground">intención cualitativa · sin horas</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin intención declarada</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 font-mono-compass text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Atención real</p>
                    <p className="font-mono-compass text-[13px] leading-[1.9] text-foreground/85">
                      plan {formatHorasCompacto(f.horas_planificadas)} · reserv {formatHorasCompacto(f.horas_reservadas)} · efect {formatHorasCompacto(f.horas_efectivas)}
                    </p>
                  </div>
                  <div>
                    <p className="mb-2 font-mono-compass text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Congruencia registrada</p>
                    <div className="flex flex-col items-start gap-1.5">
                      {f.congruencia_confirmada ? (
                        <span
                          className="rounded-md px-2.5 py-1 text-xs font-semibold"
                          style={{
                            background: `color-mix(in oklch, var(${congruenciaToken[f.congruencia_confirmada]}), transparent 85%)`,
                            color: `var(${congruenciaToken[f.congruencia_confirmada]})`,
                          }}
                        >
                          {congruenciaLabel[f.congruencia_confirmada]}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin confirmar</span>
                      )}
                      <span className="font-mono-compass text-[10px] text-muted-foreground/70">
                        {f.congruencia_sugerida ? `sugerida: ${congruenciaLabel[f.congruencia_sugerida]}` : "sin sugerencia"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-11 border-t border-border pt-9">
          <p className="mb-6 font-mono-compass text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Reflexión registrada</p>
          <div className="flex max-w-[66ch] flex-col gap-8">
            {preguntas.map((p) => (
              <div key={p.pregunta}>
                <p className="mb-2.5 font-editorial text-xl leading-snug text-muted-foreground">{p.pregunta}</p>
                <p className="text-[15px] leading-relaxed text-pretty">{p.respuesta}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-10 border-t border-border pt-5 font-mono-compass text-[10px] text-muted-foreground/70">
          Este registro es histórico. Sus valores quedaron como estaban al cerrar la revisión.
        </p>
      </div>
    </div>
  )
}
