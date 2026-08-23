"use client"
import { useCallback, useEffect, useState } from "react"
import { AlertCircle, ArrowLeft, ArrowRight, ScrollText } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { formatMesLargo, formatRangoSemana, numeroSemanaISO } from "@/lib/calendario-fechas"
import { formatFechaLarga } from "@/lib/format"
import { listRevisionesSemanales, type RevisionSemanalHistorica } from "../../../services/compassService"
import { desfaseCierre, relativoDesde } from "./historial-fechas"

const TAMANO_PAGINA = 20

function agruparPorMes(items: RevisionSemanalHistorica[]) {
  const grupos: { titulo: string; items: RevisionSemanalHistorica[] }[] = []
  items.forEach((item) => {
    const titulo = formatMesLargo(item.semana_inicio)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.titulo === titulo) ultimo.items.push(item)
    else grupos.push({ titulo, items: [item] })
  })
  return grupos
}

export function HistorialRevisionesView() {
  const [items, setItems] = useState<RevisionSemanalHistorica[]>([])
  const [offset, setOffset] = useState(0)
  const [hayMas, setHayMas] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState("")

  const cargar = useCallback(async (desde: number, reemplazar: boolean) => {
    try {
      if (reemplazar) setCargando(true); else setCargandoMas(true)
      setError("")
      const pagina = await listRevisionesSemanales({ limit: TAMANO_PAGINA, offset: desde })
      setItems((previos) => (reemplazar ? pagina : [...previos, ...pagina]))
      setHayMas(pagina.length === TAMANO_PAGINA)
      setOffset(desde + pagina.length)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cargar el historial")
    } finally {
      setCargando(false); setCargandoMas(false)
    }
  }, [])

  useEffect(() => { void cargar(0, true) }, [cargar])

  const grupos = agruparPorMes(items)
  const isEmpty = !cargando && !error && items.length === 0

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          to="/compass/revision-semanal"
          className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Revisión semanal
        </Link>
        <div>
          <p className="mb-3.5 font-mono-compass text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Compass · memoria</p>
          <h1 className="font-editorial text-4xl leading-[1.05] tracking-tight md:text-5xl">Historial de revisiones</h1>
          <p className="mt-3.5 max-w-[54ch] text-[15px] leading-relaxed text-pretty text-muted-foreground">
            Las semanas que cerraste, en orden. Cada una guarda su propia intención, su atención real y lo que decidiste ajustar.
          </p>
        </div>
      </header>

      {error && (
        <Empty className="rounded-2xl border border-border bg-card py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon"><AlertCircle /></EmptyMedia>
            <EmptyTitle className="font-editorial text-2xl font-normal">No pudimos traer tu historial</EmptyTitle>
            <EmptyDescription>Tus revisiones cerradas están guardadas; solo falló la consulta. Puedes intentarlo de nuevo.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => void cargar(0, true)}>Volver a intentar</Button>
          </EmptyContent>
        </Empty>
      )}

      {!error && cargando && (
        <div className="flex flex-col gap-0.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border-t border-border py-6 first:border-0">
              <div className="mb-3.5 h-2.5 w-20 animate-pulse rounded bg-[var(--surface-raised)]" />
              <div className="h-5 w-1/2 animate-pulse rounded bg-[var(--surface-sunken)]" />
            </div>
          ))}
          <p className="mt-4 font-mono-compass text-[11px] text-muted-foreground">Buscando revisiones cerradas…</p>
        </div>
      )}

      {isEmpty && (
        <Empty className="rounded-2xl border border-dashed border-border bg-card py-14">
          <EmptyHeader>
            <EmptyMedia variant="icon"><ScrollText /></EmptyMedia>
            <EmptyTitle className="font-editorial text-2xl font-normal">Aún no hay revisiones cerradas</EmptyTitle>
            <EmptyDescription>Cuando cierres una Revisión semanal, quedará aquí como memoria de esa semana.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              to="/compass/revision-semanal"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/80"
            >
              Ir a Revisión semanal
            </Link>
          </EmptyContent>
        </Empty>
      )}

      {!error && !cargando && items.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-3 pb-1">
            <span className="font-mono-compass text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
              {items.length === 1 ? "1 revisión cargada" : `${items.length} revisiones cargadas`}
            </span>
            <span className="font-mono-compass text-[10px] tracking-[0.12em] text-muted-foreground/60 uppercase">Más reciente primero</span>
          </div>

          {grupos.map((grupo) => (
            <section key={grupo.titulo} className="mt-6">
              <div className="sticky top-0 z-10 border-b border-border bg-background py-2 font-mono-compass text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                {grupo.titulo}
              </div>
              <div className="flex flex-col">
                {grupo.items.map((item) => (
                  <Link
                    key={item.id}
                    to={`/compass/historial/${item.semana_inicio}`}
                    className="grid grid-cols-1 items-baseline gap-1.5 border-b border-border/70 py-5 hover:bg-[var(--surface-sunken)] sm:grid-cols-[56px_1fr_auto] sm:items-center sm:gap-4 sm:rounded-lg sm:px-2"
                  >
                    <span className="font-mono-compass text-[11px] tracking-[0.06em] text-muted-foreground/70">
                      S{String(numeroSemanaISO(item.semana_inicio)).padStart(2, "0")}
                    </span>
                    <span>
                      <span className="block font-editorial text-2xl leading-tight">{formatRangoSemana(item.semana_inicio)}</span>
                      <span className="mt-1 block font-mono-compass text-[11px] text-muted-foreground">
                        Revisada el {formatFechaLarga(item.fecha_revision)} · {desfaseCierre(item.semana_inicio, item.fecha_revision)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2.5 sm:justify-end">
                      <span className="font-mono-compass text-[10px] tracking-[0.1em] text-muted-foreground/70 uppercase">
                        {relativoDesde(item.fecha_revision)}
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground/50" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          <div className="flex flex-col items-center gap-2 pt-9 pb-2">
            {hayMas ? (
              <Button variant="outline" disabled={cargandoMas} onClick={() => void cargar(offset, false)}>
                {cargandoMas ? "Cargando…" : "Ver revisiones anteriores"}
              </Button>
            ) : (
              <span className="font-mono-compass text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">
                Aquí empieza tu memoria en Compass
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
