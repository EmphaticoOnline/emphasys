"use client"
import { colorVarDeFrente } from "@/lib/frente-color"
import { formatHorasCompacto } from "@/lib/format"
import type { Congruencia, Frente, RevisionFrente } from "../../../services/compassService"
import { ConfirmacionChips, SugeridaBadge } from "./congruencia-chip"
import { expectativaLabel, notaCongruencia, prioridadLabel } from "./revision-labels"

export function FrenteRevisionCard({
  frente,
  frentesOrdenados,
  confirmada,
  onConfirmar,
}: {
  frente: RevisionFrente
  frentesOrdenados: Frente[]
  confirmada: Congruencia | ""
  onConfirmar: (valor: Congruencia | "") => void
}) {
  const color = colorVarDeFrente(frentesOrdenados, frente.frente_id)
  const esHoras = frente.horas_objetivo_snapshot != null
  const esCualitativa = !esHoras && frente.expectativa_atencion_snapshot != null
  const sinIntencion = !esHoras && !esCualitativa
  const sinAtencion = frente.horas_planificadas === 0 && frente.horas_reservadas === 0 && frente.horas_efectivas === 0
  const maxRef = Math.max(frente.horas_planificadas, frente.horas_reservadas, frente.horas_efectivas, frente.horas_objetivo_snapshot ?? 0, 1)
  const barras = [
    { label: "Planificadas", valor: frente.horas_planificadas, fill: "var(--surface-raised)" },
    { label: "Reservadas", valor: frente.horas_reservadas, fill: "color-mix(in oklch, var(--foreground), transparent 65%)" },
    { label: "Efectivas", valor: frente.horas_efectivas, fill: color },
  ]

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="h-1" style={{ background: color }} />
      <div className="flex flex-col gap-5 px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
          <h3 className="text-[15px] font-semibold tracking-tight">{frente.nombre}</h3>
          <span className="font-mono-compass text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
            {esHoras ? "con horas objetivo" : esCualitativa ? "intención cualitativa" : "sin intención"}
          </span>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <p className="mb-2 font-mono-compass text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Intención declarada</p>
            {sinIntencion ? (
              <p className="text-sm text-muted-foreground">Sin intención declarada esta semana.</p>
            ) : esHoras ? (
              <>
                <p className="font-editorial text-2xl leading-none">{formatHorasCompacto(frente.horas_objetivo_snapshot!)} objetivo</p>
                {frente.prioridad_snapshot && (
                  <p className="mt-2 text-xs text-muted-foreground">Prioridad {prioridadLabel[frente.prioridad_snapshot]}</p>
                )}
              </>
            ) : (
              <>
                <p className="font-editorial text-2xl leading-none">{expectativaLabel[frente.expectativa_atencion_snapshot!]}</p>
                <p className="mt-2 text-xs text-muted-foreground italic">Intención cualitativa · no se mide en horas</p>
              </>
            )}
          </div>

          <div>
            <p className="mb-2 font-mono-compass text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Atención real</p>
            {sinAtencion ? (
              <div className="rounded-lg border border-dashed border-border px-3 py-3">
                <p className="text-sm text-muted-foreground">Sin registro de atención esta semana.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {barras.map((b) => (
                  <div key={b.label}>
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="font-mono-compass text-[10px] tracking-[0.08em] text-muted-foreground uppercase">{b.label}</span>
                      <span className="font-mono-compass text-xs">{formatHorasCompacto(b.valor)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (b.valor / maxRef) * 100)}%`, background: b.fill }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 font-mono-compass text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Congruencia</p>
            <div className="mb-3 flex items-center gap-2">
              <span className="font-mono-compass text-[9px] tracking-[0.1em] text-muted-foreground/70 uppercase">Sugerida</span>
              <SugeridaBadge estado={frente.congruencia_sugerida} />
            </div>
            <p className="mb-1.5 font-mono-compass text-[9px] tracking-[0.1em] text-muted-foreground/70 uppercase">Tu confirmación</p>
            <ConfirmacionChips valor={confirmada} onChange={onConfirmar} />
            <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{notaCongruencia(frente.congruencia_sugerida, confirmada)}</p>
          </div>
        </div>
      </div>
    </article>
  )
}
