"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ProcesarCapturaCampos } from "./procesar-captura-campos"
import { useProcesarCaptura } from "./use-procesar-captura"
import type { Captura } from "../../../services/compassService"

export function ProcesarCapturaSheet({
  captura,
  open,
  onOpenChange,
  restantes = 0,
  onProcesada,
}: {
  captura: Captura | null
  open: boolean
  onOpenChange: (v: boolean) => void
  restantes?: number
  onProcesada?: () => void | Promise<void>
}) {
  const c = useProcesarCaptura(captura, onProcesada)
  if (!captura) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[85vh] rounded-t-2xl sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-editorial text-xl font-normal">¿En qué se convierte?</SheetTitle>
          <SheetDescription className="text-foreground">{captura.texto}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 py-3">
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
        </div>

        <SheetFooter>
          {restantes > 0 && <p className="text-center text-xs text-muted-foreground">{restantes} captura{restantes === 1 ? "" : "s"} más</p>}
          <Button size="lg" onClick={() => void c.confirmar()} disabled={!c.valid || c.loading}>Confirmar</Button>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => void c.descartar()} disabled={c.loading}><X />Descartar</Button>
            <SheetClose render={<Button variant="ghost" className="flex-1">Cerrar</Button>} />
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
