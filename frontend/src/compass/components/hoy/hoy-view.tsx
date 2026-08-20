"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"
import { ActividadHoyRow } from "./actividad-hoy-row"
import { ArcoDelDia } from "./arco-del-dia"
import { CongruenciaSemana } from "./congruencia-semana"
import { CerrarActividadDrawer } from "@/components/actividad/cerrar-actividad-drawer"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { QuickCapture } from "@/components/shell/quick-capture"
import { useRealWork } from "@/lib/real-work-store"
import { colorVarDeFrente } from "@/lib/frente-color"
import { fechaYHoraLocalAISOString, formatDuracionMin, formatFechaCorta, formatHora, formatHorasCompacto, horasEntre, hoyLocal, soloFecha } from "@/lib/format"
import { resolverSiguientesAcciones, type SiguienteAccionResuelta } from "@/lib/siguiente-accion"
import { listActividades, type Actividad } from "../../../services/compassService"

const today = hoyLocal
const iso = (day: string, plus = 0) => fechaYHoraLocalAISOString(sumarDia(day, plus))
const sumarDia = (day: string, plus: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + plus); return d.toISOString().slice(0, 10) }

function accionMeta(accion: SiguienteAccionResuelta) {
  if (accion.estado === "en_curso") return `En curso · hasta las ${formatHora(accion.fin!)}`
  if (accion.estado === "reservada") return `${formatFechaCorta(accion.inicio!)} · ${formatHora(accion.inicio!)} · ${formatDuracionMin(accion.duracionMinutos!)} reservadas`
  return "Sin tiempo reservado"
}

export function HoyView() {
  const day = today()
  const { actividades, frentes, tareas, capturas, loading, error, loadActividades, loadFrentes, loadTareas, loadCapturas } = useRealWork()
  const [selected, setSelected] = useState<Actividad | null>(null)
  const [actividadesParaAcciones, setActividadesParaAcciones] = useState<Actividad[]>([])

  const load = useCallback(async () => {
    const [, , , , todasLasActividades] = await Promise.all([
      loadActividades({ fecha_inicio: iso(day), fecha_fin: iso(day, 1) }),
      loadFrentes(),
      loadTareas({ pendientes: true }),
      loadCapturas(),
      listActividades(),
    ])
    setActividadesParaAcciones(todasLasActividades)
  }, [day, loadActividades, loadFrentes, loadTareas, loadCapturas])
  useEffect(() => { void load() }, [load])

  const visibles = useMemo(() => actividades.filter((a) => a.estado !== "cancelada"), [actividades])
  const horasProgramadas = useMemo(() => visibles.reduce((acc, a) => acc + horasEntre(a.inicio_programado, a.fin_programado), 0), [visibles])
  const frentesActivos = useMemo(() => frentes.filter((f) => f.estado === "activo"), [frentes])
  const frenteIdsHoy = useMemo(() => new Set(visibles.map((a) => a.frente_id).filter((id): id is number => id != null)), [visibles])
  const cerradas = visibles.filter((a) => a.estado !== "programada").length
  const porVenir = visibles.length - cerradas

  const frenteConMasHoras = useMemo(() => {
    const horasPorFrente = new Map<number, number>()
    for (const a of visibles) {
      if (a.frente_id == null) continue
      horasPorFrente.set(a.frente_id, (horasPorFrente.get(a.frente_id) ?? 0) + horasEntre(a.inicio_programado, a.fin_programado))
    }
    const entradas = [...horasPorFrente.entries()]
    if (entradas.length === 0) return null
    const [mejorId] = entradas.reduce((mejor, actual) => (actual[1] > mejor[1] ? actual : mejor))
    return frentes.find((f) => f.id === mejorId) ?? null
  }, [visibles, frentes])

  const actions = useMemo(() => resolverSiguientesAcciones(frentesActivos, tareas, actividadesParaAcciones), [frentesActivos, tareas, actividadesParaAcciones])
  const actionsShown = actions.slice(0, 3)
  const capturasHoy = capturas.filter((c) => soloFecha(c.captured_at) === day)

  return (
    <div className="flex flex-col">
      <header className="rounded-2xl bg-gradient-to-b from-[var(--surface-header)] to-[var(--surface-header-end)] px-5 py-4 md:px-8 md:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex max-w-lg flex-col gap-1">
            <span className="font-mono-compass text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              {new Date(`${day}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
            </span>
            <h1 className="font-editorial text-4xl leading-[0.95] tracking-tight text-foreground md:text-5xl">Hoy</h1>
            <p className="mt-0.5 text-sm text-muted-foreground text-pretty">¿Tu tiempo va a contar hoy la misma historia que tus prioridades?</p>
          </div>
          <div className="flex gap-2">
            <div className="flex flex-col gap-0.5 rounded-xl bg-[var(--surface-raised)] px-3.5 py-2">
              <span className="font-editorial text-2xl leading-none text-foreground">{visibles.length}</span>
              <span className="font-mono-compass text-[10px] font-medium tracking-[0.08em] text-muted-foreground">ACTIVIDADES</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl bg-[var(--surface-raised)] px-3.5 py-2">
              <span className="font-editorial text-2xl leading-none text-foreground">{formatHorasCompacto(horasProgramadas)}</span>
              <span className="font-mono-compass text-[10px] font-medium tracking-[0.08em] text-muted-foreground">PROGRAMADAS</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl px-3.5 py-2" style={{ background: "color-mix(in oklch, var(--chart-1), transparent 88%)" }}>
              <span className="font-editorial text-2xl leading-none" style={{ color: "var(--chart-1)" }}>{frenteIdsHoy.size} / {frentesActivos.length}</span>
              <span className="font-mono-compass text-[10px] font-medium tracking-[0.08em]" style={{ color: "var(--chart-1)" }}>FRENTES TOCADOS</span>
            </div>
          </div>
        </div>

        {visibles.length > 0 && <ArcoDelDia actividades={actividades} frentes={frentes} />}
      </header>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <CongruenciaSemana dia={day} frentes={frentes} frenteIdsHoy={frenteIdsHoy} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline gap-3">
            <h2 className="font-editorial text-2xl leading-none text-foreground">Actividades de hoy</h2>
            {visibles.length > 0 && (
              <span className="font-mono-compass text-xs text-muted-foreground">{cerradas} CERRADAS · {porVenir} POR VENIR</span>
            )}
          </div>

          {loading && actividades.length === 0 ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">Cargando…</p>
          ) : visibles.length === 0 ? (
            <Empty className="rounded-2xl bg-[var(--surface-sunken)] py-6">
              <EmptyHeader>
                <EmptyTitle className="font-editorial text-xl font-normal">El día está en blanco.</EmptyTitle>
                <EmptyDescription>Un día sin programar también cuenta una historia. Pon la primera hora donde quieras que apunte hoy.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Link to="/compass/calendario" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground">
                  Programar actividad
                </Link>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="flex flex-col">
              {visibles.map((a) => (
                <ActividadHoyRow key={a.id} actividad={a} frentes={frentes} onSelect={setSelected} />
              ))}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4 rounded-2xl bg-[var(--surface-raised)] p-4 md:p-5">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className="font-mono-compass text-[13px] font-semibold tracking-[0.12em] text-foreground/80">SIGUIENTES ACCIONES</h2>
              {actions.length > 0 && <span className="font-mono-compass text-[11px] text-muted-foreground">{actionsShown.length} / {actions.length}</span>}
            </div>

            {actions.length === 0 ? (
              <div className="flex flex-col gap-2 rounded-xl bg-[var(--surface-sunken)] px-4 py-3">
                <span className="font-editorial text-lg text-foreground">Nada decidido todavía.</span>
                <span className="text-xs text-muted-foreground">Define una siguiente acción para alguno de tus Frentes.</span>
                <QuickCapture label="Definir la primera" className="self-start" />
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-0.5">
                  {actionsShown.map((accion) => (
                    <Link
                      key={accion.frente.id}
                      to={`/compass/frentes/${accion.frente.id}`}
                      className="flex items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-accent/40"
                    >
                      <span className="mt-1 size-2 shrink-0 rounded-sm" style={{ background: colorVarDeFrente(frentes, accion.frente.id) }} />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-foreground">{accion.titulo}</span>
                        <span className="text-[11px] text-muted-foreground">{accion.frente.nombre} · {accionMeta(accion)}</span>
                      </span>
                    </Link>
                  ))}
                </div>
                {actions.length > actionsShown.length && (
                  <Link to="/compass/tareas" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    Ver las {actions.length} siguientes acciones <ArrowRight className="size-3.5" />
                  </Link>
                )}
              </>
            )}
          </div>

          <div className="h-px bg-foreground/10" />

          <div className="flex flex-col gap-2">
            <h2 className="font-mono-compass text-[13px] font-semibold tracking-[0.12em] text-foreground/80">CAPTURADO HOY</h2>
            {capturasHoy.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nada capturado todavía hoy.</p>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  {capturasHoy.map((c) => (
                    <div key={c.id} className="rounded-lg px-3 py-2 text-[13px] text-foreground" style={{ background: "color-mix(in oklch, var(--chart-5), transparent 85%)" }}>
                      «{c.texto}»
                    </div>
                  ))}
                </div>
                <Link to="/compass/bandeja" className="font-mono-compass text-[11px] text-muted-foreground hover:text-foreground">
                  {capturasHoy.length} sin clasificar → Bandeja
                </Link>
              </>
            )}
          </div>

          {frenteConMasHoras && (
            <p className="mt-auto font-editorial text-sm text-muted-foreground italic">
              Hoy tu tiempo se concentra en {frenteConMasHoras.nombre}.
            </p>
          )}
        </aside>
      </div>

      <CerrarActividadDrawer actividad={selected} open={!!selected} onOpenChange={(v) => !v && setSelected(null)} onSaved={load} />
    </div>
  )
}
