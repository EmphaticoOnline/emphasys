"use client"
import { useCallback, useEffect, useState } from "react"
import { AlertCircle, ChevronLeft, ChevronRight, RotateCcw, ScrollText } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { formatRangoSemana, inicioDeSemana, sumarDias } from "@/lib/calendario-fechas"
import { hoyLocal } from "@/lib/format"
import { useRealWork } from "@/lib/real-work-store"
import {
  getRevisionSemanal,
  saveRevisionSemanal,
  type Congruencia,
  type RevisionSemanal,
} from "../../../services/compassService"
import { FrenteRevisionCard } from "./frente-revision-card"
import { IntencionSiguienteCard, type SiguienteIntencion } from "./intencion-siguiente-card"
import { ReflexionPreguntas } from "./reflexion-preguntas"
import { RevisionHistorica } from "./revision-historica"

const CICLO = ["Claridad", "Prioridad", "Ejecución", "Medición", "Reflexión", "Ajuste"]
const CICLO_ACTIVO = new Set(["Reflexión", "Ajuste"])

export function RevisionSemanalView() {
  const { frentes, loadFrentes } = useRealWork()
  const [week, setWeek] = useState(() => inicioDeSemana(hoyLocal()))
  const [data, setData] = useState<RevisionSemanal | null>(null)
  const [editando, setEditando] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [answers, setAnswers] = useState(["", "", "", ""])
  const [confirmed, setConfirmed] = useState<Record<number, Congruencia | "">>({})
  const [next, setNext] = useState<Record<number, SiguienteIntencion>>({})

  useEffect(() => { void loadFrentes() }, [loadFrentes])

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("")
      const r = await getRevisionSemanal(week)
      setData(r)
      setEditando(!r.historica)
      setAnswers(
        r.revision
          ? [r.revision.atencion_esperada, r.revision.frentes_descuidados, r.revision.aprendizaje_principal, r.revision.ajuste_general]
          : ["", "", "", ""],
      )
      const confirmadas: Record<number, Congruencia | ""> = {}
      const siguientes: Record<number, SiguienteIntencion> = {}
      r.frentes.forEach((f) => {
        confirmadas[f.frente_id] = f.congruencia_confirmada || ""
        siguientes[f.frente_id] = {
          prioridad: f.prioridad_snapshot || "media",
          mode: f.horas_objetivo_snapshot != null ? "horas" : "expectativa",
          horas: f.horas_objetivo_snapshot != null ? String(f.horas_objetivo_snapshot) : "",
          expectativa: f.expectativa_atencion_snapshot || "atender",
        }
      })
      setConfirmed(confirmadas); setNext(siguientes)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cargar esta semana")
    } finally {
      setLoading(false)
    }
  }, [week])
  useEffect(() => { void load() }, [load])

  const valid =
    answers.every((a) => a.trim()) &&
    !!data?.frentes.every((f) => {
      const n = next[f.frente_id]
      return n && (n.mode === "expectativa" || Number(n.horas) > 0)
    })

  async function cerrarRevision() {
    if (!data) return
    try {
      setSaving(true); setError("")
      const semanaSiguiente = sumarDias(week, 7)
      await saveRevisionSemanal(week, {
        semana_inicio: week,
        atencion_esperada: answers[0]!,
        frentes_descuidados: answers[1]!,
        aprendizaje_principal: answers[2]!,
        ajuste_general: answers[3]!,
        frentes: data.frentes.map((f) => ({
          frente_id: f.frente_id,
          congruencia_confirmada: confirmed[f.frente_id] || null,
          que_ocurrio: null,
          que_bloqueo: null,
          que_aprendi: null,
          que_cambiare: null,
        })),
        proximas_intenciones: data.frentes.map((f) => {
          const n = next[f.frente_id]!
          return {
            frente_id: f.frente_id,
            semana_inicio: semanaSiguiente,
            prioridad: n.prioridad,
            horas_objetivo: n.mode === "horas" ? Number(n.horas) : null,
            expectativa_atencion: n.mode === "expectativa" ? n.expectativa : null,
            comentario: null,
          }
        }),
      })
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la revisión")
    } finally {
      setSaving(false)
    }
  }

  const isEmpty = !loading && !error && !!data && data.frentes.length === 0
  const isSnapshot = !loading && !error && !!data && data.frentes.length > 0 && data.historica && !editando
  const isCurso = !loading && !error && !!data && data.frentes.length > 0 && (!data.historica || editando)

  return (
    <div className="flex flex-col gap-8">
      <header className="rounded-2xl bg-gradient-to-b from-[var(--surface-header)] to-[var(--surface-header-end)] px-5 py-6 md:px-10 md:py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="mb-3.5 font-mono-compass text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              {isSnapshot ? "Compass · revisión cerrada" : `Compass · semana ${formatRangoSemana(week)}`}
            </p>
            <h1 className="font-editorial text-4xl leading-[1.05] tracking-tight md:text-5xl">Revisión semanal</h1>
            <p className="mt-3.5 max-w-[56ch] text-[15px] leading-relaxed text-pretty text-muted-foreground">
              {isSnapshot
                ? "Así quedó registrada esa semana. Nada de lo que ves aquí se vuelve a calcular."
                : "Un rato para mirar la semana con calma: qué recibió tu atención, qué no, y qué quieres ajustar."}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2.5">
            <Link
              to="/compass/historial"
              className="inline-flex items-center gap-1.5 font-mono-compass text-[10px] tracking-[0.1em] text-muted-foreground uppercase hover:text-foreground"
            >
              <ScrollText className="size-3.5" />
              Historial
            </Link>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" aria-label="Semana anterior" onClick={() => setWeek((w) => sumarDias(w, -7))}>
                <ChevronLeft />
              </Button>
              <input
                type="date"
                value={week}
                onChange={(e) => { if (e.target.value) setWeek(inicioDeSemana(e.target.value)) }}
                className="h-9 rounded-md border border-input bg-transparent px-2.5 font-mono-compass text-xs"
              />
              <Button variant="outline" size="icon" aria-label="Semana siguiente" onClick={() => setWeek((w) => sumarDias(w, 7))}>
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-1.5 border-t border-border/70 pt-5">
          {CICLO.map((etapa) => {
            const activa = CICLO_ACTIVO.has(etapa)
            return (
              <span
                key={etapa}
                className={`rounded px-2.5 py-1 font-mono-compass text-[10px] tracking-[0.1em] uppercase ${
                  activa ? "bg-[var(--surface-raised)] text-foreground" : "text-muted-foreground/50"
                }`}
              >
                {etapa}
              </span>
            )
          })}
        </div>
      </header>

      {error && (
        <Empty className="rounded-2xl border border-border bg-card py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon"><AlertCircle /></EmptyMedia>
            <EmptyTitle className="font-editorial text-2xl font-normal">No pudimos cargar esta semana</EmptyTitle>
            <EmptyDescription>Tus respuestas guardadas están intactas. Puedes intentar cargar de nuevo; nada de lo escrito se pierde.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => void load()}><RotateCcw />Volver a cargar</Button>
          </EmptyContent>
        </Empty>
      )}

      {!error && loading && (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[120px] animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      )}

      {isEmpty && (
        <Empty className="rounded-2xl border border-dashed border-border bg-card py-14">
          <EmptyHeader>
            <EmptyMedia variant="icon"><ScrollText /></EmptyMedia>
            <EmptyTitle className="font-editorial text-2xl font-normal">Todavía no hay semana que revisar</EmptyTitle>
            <EmptyDescription>
              Cuando declares intención en tus Frentes y registres atención, esta vista reunirá lo ocurrido para que puedas reflexionar sobre ello.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {isSnapshot && data && (
        <div className="flex flex-col gap-6">
          <RevisionHistorica data={data} frentesOrdenados={frentes} rangoSemana={formatRangoSemana(week)} />
          <Button variant="outline" className="self-start" onClick={() => setEditando(true)}>Editar esta revisión</Button>
        </div>
      )}

      {isCurso && data && (
        <div className="flex flex-col gap-16">
          <section>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-editorial text-3xl">Frente por frente</h2>
              <span className="font-mono-compass text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Intención · atención · congruencia</span>
            </div>
            <div className="flex flex-col gap-3.5">
              {data.frentes.map((f) => (
                <FrenteRevisionCard
                  key={f.frente_id}
                  frente={f}
                  frentesOrdenados={frentes}
                  confirmada={confirmed[f.frente_id] || ""}
                  onConfirmar={(v) => setConfirmed((prev) => ({ ...prev, [f.frente_id]: v }))}
                />
              ))}
            </div>
          </section>

          <section className="border-t border-border pt-11">
            <p className="mb-4 font-mono-compass text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Reflexión</p>
            <h2 className="mb-2.5 max-w-[26ch] font-editorial text-4xl leading-tight">Lo que la semana te dejó</h2>
            <p className="mb-10 max-w-[52ch] text-[15px] leading-relaxed text-muted-foreground">
              Cuatro preguntas, sin respuesta correcta. Escribe lo justo para reconocer lo que pasó.
            </p>
            <ReflexionPreguntas
              respuestas={answers}
              onChange={(i, v) => setAnswers((a) => a.map((x, idx) => (idx === i ? v : x)))}
            />
          </section>

          <section className="border-t border-border pt-11">
            <p className="mb-4 font-mono-compass text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Ajuste</p>
            <h2 className="mb-2.5 max-w-[26ch] font-editorial text-4xl leading-tight">Intención para la próxima semana</h2>
            <p className="mb-8 max-w-[54ch] text-[15px] leading-relaxed text-muted-foreground">
              Cada Frente declara horas objetivo o una expectativa cualitativa. Nunca las dos.
            </p>
            <div className="flex flex-col gap-3">
              {data.frentes.map((f) => {
                const n = next[f.frente_id]
                if (!n) return null
                return (
                  <IntencionSiguienteCard
                    key={f.frente_id}
                    frente={f}
                    frentesOrdenados={frentes}
                    valor={n}
                    onChange={(patch) => setNext((prev) => ({ ...prev, [f.frente_id]: { ...prev[f.frente_id]!, ...patch } }))}
                  />
                )
              })}
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-4 border-t border-border pt-6">
              <Button disabled={!valid || saving} onClick={() => void cerrarRevision()} className="min-h-12 px-6">
                {saving ? "Guardando…" : "Cerrar la revisión"}
              </Button>
              <span className="max-w-[44ch] text-[13px] leading-relaxed text-muted-foreground">
                Al cerrarla, los valores de esta semana quedan congelados como memoria y no se recalculan.
              </span>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
