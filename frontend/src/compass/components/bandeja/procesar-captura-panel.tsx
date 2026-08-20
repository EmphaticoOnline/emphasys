"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatFechaCorta, formatHora24 } from "@/lib/format"
import type { Captura } from "../../../services/compassService"
import { ProcesarCapturaCampos } from "./procesar-captura-campos"
import { useProcesarCaptura } from "./use-procesar-captura"

export function ProcesarCapturaPanel({
  captura,
  restantes,
  onClose,
  onProcesada,
}: {
  captura: Captura
  restantes: number
  onClose: () => void
  onProcesada: () => void | Promise<void>
}) {
  const c = useProcesarCaptura(captura, onProcesada)

  return (
    <div className="flex h-full flex-col gap-5 rounded-2xl bg-[var(--surface-raised)] p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono-compass text-[10.5px] tracking-[0.08em] text-muted-foreground uppercase">
          {restantes <= 0 ? "Última captura" : `Quedan ${restantes} captura${restantes === 1 ? "" : "s"}`}
        </span>
        <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Cerrar</button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="font-editorial text-2xl leading-snug text-pretty text-foreground">{captura.texto}</p>
        <p className="mt-3 font-mono-compass text-[10.5px] tracking-[0.08em] text-muted-foreground uppercase">Capturado {formatFechaCorta(captura.captured_at)} · {formatHora24(captura.captured_at)}</p>
      </div>

      <ProcesarCapturaCampos
        captura={captura}
        frentes={c.frentes}
        destino={c.destino}
        setDestino={c.setDestino}
        frenteId={c.frenteId}
        setFrenteId={c.setFrenteId}
        fecha={c.fecha}
        setFecha={c.setFecha}
        hora={c.hora}
        setHora={c.setHora}
        nombre={c.nombre}
        setNombre={c.setNombre}
        proposito={c.proposito}
        setProposito={c.setProposito}
        categoria={c.categoria}
        setCategoria={c.setCategoria}
      />

      <div className="mt-auto flex items-center gap-3 border-t border-border pt-4">
        <Button onClick={() => void c.confirmar()} disabled={!c.valid || c.loading}>Confirmar</Button>
        <Button variant="outline" onClick={() => void c.descartar()} disabled={c.loading}><X />Descartar</Button>
      </div>
    </div>
  )
}
