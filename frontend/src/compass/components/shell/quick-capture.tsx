"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Textarea } from "@/components/ui/textarea"
import { useRealWork } from "@/lib/real-work-store"
import { cn } from "@/lib/utils"

export function QuickCapture({ className }: { className?: string }) {
  const { crearCaptura, loading } = useRealWork()
  const [open, setOpen] = useState(false)
  const [texto, setTexto] = useState("")

  async function handleSubmit() {
    const value = texto.trim()
    if (!value) return
    await crearCaptura(value)
    setTexto("")
    setOpen(false)
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
      <DrawerTrigger
        render={
          <button
            type="button"
            aria-label="Capturar algo nuevo"
            className={cn(
              "flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-95",
              className,
            )}
          >
            <Plus className="size-6" />
          </button>
        }
      />
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="font-heading text-lg">Captura rápida</DrawerTitle>
          <DrawerDescription>Escribe lo que tengas en mente. Lo clasificas después, en la bandeja.</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 py-3">
          <Textarea
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="¿Qué tienes en mente?"
            className="min-h-28 resize-none text-base"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void handleSubmit()
              }
            }}
          />
        </div>
        <DrawerFooter>
          <Button size="lg" onClick={() => void handleSubmit()} disabled={!texto.trim() || loading}>
            Guardar en la bandeja
          </Button>
          <DrawerClose render={<Button variant="ghost">Cancelar</Button>} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
