"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ResponsiveOperationOverlay } from "@/components/ui/responsive-operation-overlay"
import { Textarea } from "@/components/ui/textarea"
import { useRealWork } from "@/lib/real-work-store"
import { cn } from "@/lib/utils"

export function QuickCapture({ className, label }: { className?: string; label?: string }) {
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
    <ResponsiveOperationOverlay
      open={open}
      onOpenChange={setOpen}
      eyebrow="Captura rápida"
      title="¿Qué tienes en mente?"
      description="Escribe lo que tengas en mente. Lo clasificas después, en la bandeja."
      trigger={
          label ? (
            <button
              type="button"
              aria-label="Capturar algo nuevo"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-95",
                className,
              )}
            >
              <Plus className="size-4" />
              {label}
            </button>
          ) : (
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
          )
      }
      footer={
        <>
          <Button size="lg" onClick={() => void handleSubmit()} disabled={!texto.trim() || loading}>
            Guardar en la bandeja
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
        </>
      }
    >
        <div>
          <Textarea
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="¿Qué tienes en mente?"
            className="min-h-32 resize-none rounded-xl border-border bg-card px-3.5 py-3 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] focus-visible:border-ring/70 focus-visible:ring-2 focus-visible:ring-ring/20"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void handleSubmit()
              }
            }}
          />
        </div>
    </ResponsiveOperationOverlay>
  )
}
