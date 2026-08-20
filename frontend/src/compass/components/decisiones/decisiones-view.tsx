"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Gavel, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { colorVarDeFrente } from "@/lib/frente-color"
import { createDecision, listDecisiones, listFrentes, type Decision, type DecisionCreate, type Frente } from "../../../services/compassService"
import { CrearDecisionDialog } from "./crear-decision-dialog"

const TODOS_LOS_ESTADOS_FRENTE = ["activo", "pausado", "completado", "archivado"] as const

/** Fecha-calendario (YYYY-MM-DD) sin conversión de zona horaria — mismo patrón que real-frentes.tsx/calendario-view.tsx. */
function parseFecha(ymd: string) {
  return new Date(`${ymd}T12:00:00`)
}
function formatFechaCorta(ymd: string) {
  return parseFecha(ymd).toLocaleDateString("es-MX", { day: "numeric", month: "short" })
}
function mesLabel(ymd: string) {
  return parseFecha(ymd).toLocaleDateString("es-MX", { month: "long", year: "numeric" })
}

function agruparPorMes(decisiones: Decision[]) {
  const ordenadas = [...decisiones].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
  const grupos: { label: string; items: Decision[] }[] = []
  for (const d of ordenadas) {
    const label = mesLabel(d.fecha)
    const grupo = grupos.find((g) => g.label === label)
    if (grupo) grupo.items.push(d)
    else grupos.push({ label, items: [d] })
  }
  return grupos
}

export function DecisionesView() {
  const [decisiones, setDecisiones] = useState<Decision[]>([])
  const [frentes, setFrentes] = useState<Frente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("")
      const [d, f] = await Promise.all([listDecisiones(), listFrentes([...TODOS_LOS_ESTADOS_FRENTE])])
      setDecisiones(d); setFrentes(f)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar las Decisiones")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const grupos = useMemo(() => agruparPorMes(decisiones), [decisiones])

  async function crear(payload: DecisionCreate) {
    await createDecision(payload)
    await load()
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl bg-gradient-to-b from-[var(--surface-header)] to-[var(--surface-header-end)] px-5 py-4 md:px-8 md:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-lg flex-col gap-1">
            <h1 className="font-editorial text-4xl leading-[0.95] tracking-tight text-foreground md:text-5xl">Decisiones</h1>
            <p className="mt-0.5 font-editorial text-lg text-pretty text-muted-foreground italic">Registro de qué decidí y por qué.</p>
          </div>
          <Button onClick={() => setCreating(true)} className="min-h-11 md:min-h-9"><Plus />Registrar decisión</Button>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-card px-5 py-5">
          <p className="font-editorial text-lg text-destructive">No pudimos abrir el registro</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => void load()}>Reintentar</Button>
        </div>
      )}

      {!error && loading && decisiones.length === 0 && (
        <div className="flex max-w-3xl flex-col gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-[90px] animate-pulse rounded-2xl border border-border bg-[var(--surface-sunken)]" />)}
        </div>
      )}

      {!error && !(loading && decisiones.length === 0) && decisiones.length === 0 && (
        <Empty className="rounded-2xl bg-[var(--surface-sunken)] py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Gavel /></EmptyMedia>
            <EmptyTitle className="font-editorial text-xl font-normal">El registro está vacío</EmptyTitle>
            <EmptyDescription>La primera decisión que anotes queda aquí, con su fecha y su motivo.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setCreating(true)}><Plus />Registrar decisión</Button>
          </EmptyContent>
        </Empty>
      )}

      {!error && !(loading && decisiones.length === 0) && decisiones.length > 0 && (
        <div className="flex max-w-3xl flex-col gap-8">
          {grupos.map((grupo) => (
            <section key={grupo.label} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="font-mono-compass text-[10.5px] tracking-[0.16em] text-muted-foreground uppercase">{grupo.label}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                {grupo.items.map((d, i) => {
                  const color = colorVarDeFrente(frentes, d.frente_id)
                  return (
                    <div key={d.id} className={`grid grid-cols-[96px_1fr] gap-5 px-5 py-5 sm:grid-cols-[116px_1fr] ${i !== 0 ? "border-t border-border" : ""}`}>
                      <div className="flex flex-col gap-1.5 pt-0.5">
                        <span className="font-mono-compass text-[11px] text-muted-foreground">{formatFechaCorta(d.fecha)}</span>
                        {d.frente_id != null && (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                            <span className="font-mono-compass text-[9.5px] tracking-[0.1em] uppercase" style={{ color }}>{d.frente_nombre}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-col gap-2.5">
                        <p className="font-editorial text-[22px] leading-snug text-pretty text-foreground">{d.titulo}</p>
                        {d.descripcion && <p className="max-w-[62ch] text-sm leading-relaxed text-pretty text-muted-foreground">{d.descripcion}</p>}
                        {d.motivo && (
                          <div className="flex max-w-[62ch] flex-col gap-1 rounded-xl bg-[var(--surface-sunken)] px-3.5 py-3">
                            <span className="font-mono-compass text-[9.5px] tracking-[0.12em] text-muted-foreground uppercase">Por qué</span>
                            <p className="text-sm leading-relaxed text-pretty text-foreground/80">{d.motivo}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
          <p className="font-mono-compass text-[10px] tracking-[0.12em] text-muted-foreground/70 uppercase">Si cambia el criterio, se registra otra decisión</p>
        </div>
      )}

      {creating && <CrearDecisionDialog frentes={frentes} onClose={() => setCreating(false)} onCreate={crear} />}
    </div>
  )
}
