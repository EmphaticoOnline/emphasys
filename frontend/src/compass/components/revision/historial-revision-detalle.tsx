"use client"
import { useCallback, useEffect, useState } from "react"
import { AlertCircle, ArrowLeft } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { formatRangoSemana } from "@/lib/calendario-fechas"
import { useRealWork } from "@/lib/real-work-store"
import { getRevisionSemanal, type RevisionSemanal } from "../../../services/compassService"
import { RevisionHistorica } from "./revision-historica"

export function HistorialRevisionDetalle() {
  const { semana } = useParams<{ semana: string }>()
  const { frentes, loadFrentes } = useRealWork()
  const [data, setData] = useState<RevisionSemanal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => { void loadFrentes() }, [loadFrentes])

  const load = useCallback(async () => {
    if (!semana) return
    try {
      setLoading(true); setError("")
      setData(await getRevisionSemanal(semana))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cargar esta revisión")
    } finally {
      setLoading(false)
    }
  }, [semana])
  useEffect(() => { void load() }, [load])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          to="/compass/historial"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Historial
        </Link>
        <Link
          to="/compass/revision-semanal"
          className="font-mono-compass text-[10px] tracking-[0.14em] text-muted-foreground uppercase hover:text-foreground"
        >
          Revisión semanal actual
        </Link>
      </div>

      {error && (
        <Empty className="rounded-2xl border border-border bg-card py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon"><AlertCircle /></EmptyMedia>
            <EmptyTitle className="font-editorial text-2xl font-normal">No pudimos cargar esta revisión</EmptyTitle>
            <EmptyDescription>Sigue guardada en tu historial; solo falló la consulta. Intenta de nuevo.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => void load()}>Volver a intentar</Button>
          </EmptyContent>
        </Empty>
      )}

      {!error && loading && <div className="h-[320px] animate-pulse rounded-2xl border border-border bg-card" />}

      {!error && !loading && data?.revision && semana && (
        <div className="flex flex-col gap-6">
          <RevisionHistorica data={data} frentesOrdenados={frentes} rangoSemana={formatRangoSemana(semana)} />
          <div className="flex flex-wrap gap-2.5">
            <Link
              to="/compass/historial"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
            >
              Volver al historial
            </Link>
            <Link
              to="/compass/revision-semanal"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/80"
            >
              Revisión semanal
            </Link>
          </div>
        </div>
      )}

      {!error && !loading && data && !data.revision && (
        <Empty className="rounded-2xl border border-dashed border-border bg-card py-14">
          <EmptyHeader>
            <EmptyTitle className="font-editorial text-2xl font-normal">Esta semana no tiene una revisión cerrada</EmptyTitle>
            <EmptyDescription>Puede que el enlace apunte a una semana distinta a la guardada en tu historial.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              to="/compass/historial"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
            >
              Volver al historial
            </Link>
          </EmptyContent>
        </Empty>
      )}
    </div>
  )
}
