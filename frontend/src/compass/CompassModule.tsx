import { useEffect } from "react"
import { Outlet } from "react-router-dom"
import { AppShell } from "@/components/shell/app-shell"
import { HoyView } from "@/components/hoy/hoy-view"
import { RealFrenteDetailView, RealFrentesView } from "@/components/frentes/real-frentes"
import { TareasView } from "@/components/tareas/tareas-view"
import { CalendarioView } from "@/components/calendario/calendario-view"
import { BandejaView } from "@/components/bandeja/bandeja-view"
import { IdeasView } from "@/components/ideas/ideas-view"
import { DecisionesView } from "@/components/decisiones/decisiones-view"
import { RevisionSemanalView } from "@/components/revision/revision-semanal-view"
import { HistorialRevisionesView } from "@/components/revision/historial-revisiones-view"
import { HistorialRevisionDetalle } from "@/components/revision/historial-revision-detalle"

export function CompassLayout() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = "Emphasys Compass"
    return () => { document.title = previousTitle }
  }, [])

  return <AppShell><Outlet /></AppShell>
}

export {
  HoyView, RealFrentesView, RealFrenteDetailView, TareasView, CalendarioView, BandejaView, IdeasView, DecisionesView,
  RevisionSemanalView, HistorialRevisionesView, HistorialRevisionDetalle,
}
