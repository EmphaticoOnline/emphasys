"use client"

import { useEffect, useMemo, useState } from "react"
import { Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { QuickCapture } from "@/components/shell/quick-capture"
import { useRealWork } from "@/lib/real-work-store"
import { formatFechaCorta, formatHora24 } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Captura } from "../../../services/compassService"
import { ProcesarCapturaPanel } from "./procesar-captura-panel"
import { ProcesarCapturaSheet } from "./procesar-captura-sheet"

/**
 * `ProcesarCapturaSheet` porta su contenido a `document.body` (Dialog de base-ui),
 * así que envolverlo en una clase `md:hidden` no basta para ocultarlo en desktop.
 * Este hook local decide en JS si el destino visual es el panel inline (desktop)
 * o la hoja inferior (mobile), para no montar ambas superficies a la vez.
 */
function useEsDesktop() {
  const [esDesktop, setEsDesktop] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const listener = () => setEsDesktop(mq.matches)
    mq.addEventListener("change", listener)
    return () => mq.removeEventListener("change", listener)
  }, [])
  return esDesktop
}

/** Señal suave de antigüedad — nunca urgente, nunca bloquea nada. */
function edadCaptura(capturedAt: string) {
  const dias = Math.floor((Date.now() - new Date(capturedAt).getTime()) / 86400000)
  if (dias >= 7) return `hace ${dias} días`
  if (dias >= 3) return "hace unos días"
  return null
}

function CapturaRow({ captura, seleccionada, onSelect }: { captura: Captura; seleccionada: boolean; onSelect: () => void }) {
  const edad = edadCaptura(captura.captured_at)
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors",
        seleccionada ? "border-primary/40 bg-card shadow-sm" : "border-border bg-card/70 hover:bg-card",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-relaxed text-pretty text-foreground">{captura.texto}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="font-mono-compass text-[10.5px] tracking-[0.08em] text-muted-foreground uppercase">
            {formatFechaCorta(captura.captured_at)} · {formatHora24(captura.captured_at)}
          </span>
          {edad && <span className="font-mono-compass text-[10.5px] tracking-[0.08em] text-muted-foreground/60 uppercase">{edad}</span>}
        </div>
      </div>
      {seleccionada && <span className="pt-0.5 font-mono-compass text-[10px] tracking-[0.08em] text-primary uppercase">Aclarando</span>}
    </button>
  )
}

export function BandejaView() {
  const { capturas, loading, error, loadCapturas } = useRealWork()
  const [selected, setSelected] = useState<Captura | null>(null)

  useEffect(() => { void loadCapturas() }, [loadCapturas])
  useEffect(() => {
    if (selected && !capturas.some((c) => c.id === selected.id)) setSelected(null)
  }, [capturas, selected])

  const restantes = useMemo(() => Math.max(capturas.length - (selected ? 1 : 0), 0), [capturas.length, selected])
  const muchasCapturas = capturas.length >= 6
  const esDesktop = useEsDesktop()

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl bg-gradient-to-b from-[var(--surface-header)] to-[var(--surface-header-end)] px-5 py-4 md:px-8 md:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-lg flex-col gap-1.5">
            <h1 className="font-editorial text-4xl leading-[0.95] tracking-tight text-foreground md:text-5xl">Bandeja</h1>
            <p className="mt-0.5 text-sm text-pretty text-muted-foreground">
              Todo lo que capturaste sin pensarlo. Aclara una cosa a la vez y déjala ir a su sitio.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-0.5 rounded-xl bg-[var(--surface-raised)] px-3.5 py-2">
              <span className="font-editorial text-2xl leading-none text-foreground">{capturas.length}</span>
              <span className="font-mono-compass text-[10px] font-medium tracking-[0.08em] text-muted-foreground">
                {capturas.length === 1 ? "PENDIENTE" : "PENDIENTES"}
              </span>
            </div>
            <QuickCapture label="Capturar" className="min-h-11 md:min-h-9" />
          </div>
        </div>
        {muchasCapturas && (
          <p className="mt-3 font-mono-compass text-[10.5px] tracking-[0.08em] text-muted-foreground/70 uppercase">Se han juntado unas cuantas · sin prisa</p>
        )}
      </header>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-card px-5 py-5">
          <p className="font-editorial text-lg text-destructive">No pudimos cargar tu Bandeja</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => void loadCapturas()}>Reintentar</Button>
        </div>
      )}

      {!error && loading && capturas.length === 0 && (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => <div key={i} className="h-[82px] animate-pulse rounded-2xl border border-border bg-[var(--surface-sunken)]" />)}
        </div>
      )}

      {!error && !(loading && capturas.length === 0) && capturas.length === 0 && (
        <Empty className="rounded-2xl bg-[var(--surface-sunken)] py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
            <EmptyTitle className="font-editorial text-xl font-normal">Nada pendiente por aclarar</EmptyTitle>
            <EmptyDescription>Espacio liberado. Lo que capturaste ya vive donde tiene sentido — la Bandeja vuelve a estar disponible cuando la necesites.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <QuickCapture label="Capturar algo" />
          </EmptyContent>
        </Empty>
      )}

      {!error && !(loading && capturas.length === 0) && capturas.length > 0 && (
        <div className="flex flex-col gap-5 md:grid md:grid-cols-[1fr_420px] md:items-start">
          <div className="flex flex-col gap-2">
            {capturas.map((c) => (
              <CapturaRow key={c.id} captura={c} seleccionada={selected?.id === c.id} onSelect={() => setSelected(c)} />
            ))}
          </div>

          <div className="hidden md:block">
            {selected ? (
              <ProcesarCapturaPanel
                captura={selected}
                restantes={restantes}
                onClose={() => setSelected(null)}
                onProcesada={async () => { setSelected(null); await loadCapturas() }}
              />
            ) : (
              <div className="flex flex-col gap-3 rounded-2xl bg-[var(--surface-raised)] p-6">
                <h2 className="font-editorial text-2xl text-foreground">Una a la vez</h2>
                <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
                  Elige una captura de la lista y decide en qué se convierte. El resto puede esperar.
                </p>
                <span className="font-mono-compass text-[10.5px] tracking-[0.08em] text-muted-foreground/70 uppercase">
                  {capturas.length === 1 ? "última captura" : `quedan ${capturas.length} capturas`}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <ProcesarCapturaSheet
        captura={selected}
        open={!esDesktop && !!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        restantes={restantes}
        onProcesada={async () => { setSelected(null); await loadCapturas() }}
      />
    </div>
  )
}
