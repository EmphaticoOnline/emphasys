"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCompass } from "@/lib/store"
import { capitalizarPrimera, formatFechaLarga } from "@/lib/format"

function horaMin(hora: number) {
  return `${String(hora).padStart(2, "0")}:00`
}

export function CrearActividadDialog({
  fecha,
  hora,
  open,
  onOpenChange,
}: {
  fecha: string | null
  hora: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { frentes, crearActividad } = useCompass()
  const [titulo, setTitulo] = useState("")
  const [frenteId, setFrenteId] = useState<string | undefined>(undefined)
  const [horaInicio, setHoraInicio] = useState("09:00")
  const [horaFin, setHoraFin] = useState("10:00")

  useEffect(() => {
    if (open && hora !== null) {
      setHoraInicio(horaMin(hora))
      setHoraFin(horaMin(Math.min(hora + 1, 23)))
      setTitulo("")
      setFrenteId(undefined)
    }
  }, [open, hora])

  if (!fecha) return null

  function crear() {
    if (!titulo.trim()) return
    crearActividad({
      titulo: titulo.trim(),
      frenteId,
      inicio: `${fecha}T${horaInicio}:00`,
      fin: `${fecha}T${horaFin}:00`,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva actividad</DialogTitle>
          <DialogDescription>{capitalizarPrimera(formatFechaLarga(fecha))}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="titulo-actividad">Qué vas a hacer</FieldLabel>
            <Input
              id="titulo-actividad"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej. Revisión de avance con el equipo"
              autoFocus
            />
          </Field>

          <div className="flex gap-3">
            <Field className="flex-1">
              <FieldLabel htmlFor="hora-inicio">Inicio</FieldLabel>
              <Input
                id="hora-inicio"
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </Field>
            <Field className="flex-1">
              <FieldLabel htmlFor="hora-fin">Fin</FieldLabel>
              <Input id="hora-fin" type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
            </Field>
          </div>

          <Field>
            <FieldLabel>Frente relacionado (opcional)</FieldLabel>
            <Select value={frenteId} onValueChange={(value) => setFrenteId(value ?? undefined)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sin frente asociado" />
              </SelectTrigger>
              <SelectContent>
                {frentes.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button onClick={crear} disabled={!titulo.trim() || horaFin <= horaInicio}>
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
