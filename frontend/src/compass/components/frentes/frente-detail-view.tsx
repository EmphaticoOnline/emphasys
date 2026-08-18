"use client"

import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Lightbulb, ScrollText } from "lucide-react"
import { CerrarActividadDrawer } from "@/components/actividad/cerrar-actividad-drawer"
import { ActividadRow } from "@/components/actividad/actividad-row"
import { IndicadorCongruencia } from "@/components/congruencia/indicador"
import { EvolucionAtencion } from "@/components/frentes/evolucion-atencion"
import { SiguienteAccionCard } from "@/components/frentes/siguiente-accion-card"
import { Badge } from "@/components/ui/badge"
import { congruenciaDescripcion, sugerirCongruencia } from "@/lib/congruencia"
import { getDecisionesDeFrente, getIdeasDeFrente } from "@/lib/data"
import { formatFechaCorta } from "@/lib/format"
import { useCompass } from "@/lib/store"
import type { Actividad } from "@/lib/types"
import { cn } from "@/lib/utils"

export function FrenteDetailView({ frenteId }: { frenteId: string }) {
  const { frentes, actividades, intenciones, medicion, tareas, toggleTarea } = useCompass()
  const frente = frentes.find((f) => f.id === frenteId)
  const [seleccionada, setSeleccionada] = useState<Actividad | null>(null)
  const [open, setOpen] = useState(false)

  const intencion = intenciones.find((i) => i.frenteId === frenteId)
  const med = medicion.find((m) => m.frenteId === frenteId)
  const estado = frente ? sugerirCongruencia(intencion, med) : "Congruente"

  const tareasFrente = useMemo(
    () => tareas.filter((t) => t.frenteId === frenteId),
    [tareas, frenteId],
  )
  const tareasProximas = useMemo(
    () =>
      tareasFrente
        .filter((t) => t.estado === "Pendiente")
        .sort((a, b) => {
          if (!a.fechaLimite && !b.fechaLimite) return 0
          if (!a.fechaLimite) return 1
          if (!b.fechaLimite) return -1
          return a.fechaLimite < b.fechaLimite ? -1 : 1
        })
        .slice(0, 3),
    [tareasFrente],
  )
  const actividadesFrente = useMemo(
    () =>
      actividades
        .filter((a) => a.frenteId === frenteId && a.estado !== "Cancelada")
        .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime())
        .slice(0, 8),
    [actividades, frenteId],
  )
  const ideasFrente = getIdeasDeFrente(frenteId)
  const decisionesFrente = getDecisionesDeFrente(frenteId)

  function abrirCierre(actividad: Actividad) {
    setSeleccionada(actividad)
    setOpen(true)
  }

  if (!frente) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">No se encontró este frente.</p>
        <Link to="/compass/frentes" className="text-sm text-foreground underline">
          Volver a Frentes
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      <Link
        to="/compass/frentes"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Frentes
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: `var(--${frente.color})` }}
            aria-hidden
          />
          <Badge variant="secondary">{frente.categoria}</Badge>
          {frente.estado !== "Activo" && <Badge variant="outline">{frente.estado}</Badge>}
        </div>
        <h1 className="font-heading text-3xl tracking-tight text-foreground">{frente.nombre}</h1>
        <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">{frente.proposito}</p>
      </header>

      <SiguienteAccionCard frente={frente} />

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm text-muted-foreground">Congruencia esta semana</h2>
          <IndicadorCongruencia estado={estado} />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{congruenciaDescripcion[estado]}</p>
        {intencion?.horasObjetivo ? (
          <div className="flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
            <span>Objetivo: {intencion.horasObjetivo}h</span>
            <span>Efectivas: {med?.horasEfectivas ?? 0}h</span>
            <span>Protegidas: {med?.horasProtegidas ?? 0}h</span>
          </div>
        ) : (
          <div className="border-t border-border pt-3 text-xs text-muted-foreground">
            Expectativa: {intencion?.expectativa ?? "Atender"}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm text-muted-foreground">Evolución de la atención</h2>
        <EvolucionAtencion frenteId={frenteId} />
      </section>

      {tareasProximas.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-sm text-muted-foreground">Próximas tareas</h2>
          <div className="flex flex-col rounded-2xl border border-border bg-card">
            {tareasProximas.map((t, i) => (
              <label
                key={t.id}
                className={cn("flex items-center gap-3 px-4 py-3 text-sm", i !== 0 && "border-t border-border")}
              >
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => toggleTarea(t.id)}
                  className="size-4 rounded border-border accent-foreground"
                />
                <span className="flex-1">{t.titulo}</span>
                {t.fechaLimite && (
                  <span className="text-xs text-muted-foreground">{formatFechaCorta(t.fechaLimite)}</span>
                )}
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm text-muted-foreground">Todas las tareas</h2>
        {tareasFrente.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay tareas ligadas a este frente.</p>
        ) : (
          <div className="flex flex-col rounded-2xl border border-border bg-card">
            {tareasFrente.map((t, i) => (
              <label
                key={t.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-sm",
                  i !== 0 && "border-t border-border",
                )}
              >
                <input
                  type="checkbox"
                  checked={t.estado === "Completada"}
                  onChange={() => toggleTarea(t.id)}
                  className="size-4 rounded border-border accent-foreground"
                />
                <span className={cn("flex-1", t.estado === "Completada" && "text-muted-foreground line-through")}>
                  {t.titulo}
                </span>
                {t.fechaLimite && (
                  <span className="text-xs text-muted-foreground">{formatFechaCorta(t.fechaLimite)}</span>
                )}
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm text-muted-foreground">Actividad reciente</h2>
        {actividadesFrente.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin actividades registradas aún.</p>
        ) : (
          <div className="flex flex-col rounded-2xl border border-border bg-card">
            {actividadesFrente.map((a, i) => (
              <div key={a.id} className={i !== 0 ? "border-t border-border" : ""}>
                <ActividadRow actividad={a} onSelect={abrirCierre} />
              </div>
            ))}
          </div>
        )}
      </section>

      {(ideasFrente.length > 0 || decisionesFrente.length > 0) && (
        <section className="grid gap-6 sm:grid-cols-2">
          {ideasFrente.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="flex items-center gap-1.5 font-heading text-sm text-muted-foreground">
                <Lightbulb className="size-3.5" />
                Ideas
              </h2>
              <div className="flex flex-col gap-2">
                {ideasFrente.map((idea) => (
                  <div key={idea.id} className="rounded-xl border border-border bg-card px-3.5 py-3 text-sm text-foreground">
                    {idea.texto}
                  </div>
                ))}
              </div>
            </div>
          )}
          {decisionesFrente.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="flex items-center gap-1.5 font-heading text-sm text-muted-foreground">
                <ScrollText className="size-3.5" />
                Decisiones
              </h2>
              <div className="flex flex-col gap-2">
                {decisionesFrente.map((d) => (
                  <div key={d.id} className="rounded-xl border border-border bg-card px-3.5 py-3">
                    <p className="text-sm text-foreground">{d.que}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{d.porque}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <CerrarActividadDrawer actividad={seleccionada} open={open} onOpenChange={setOpen} />
    </div>
  )
}
