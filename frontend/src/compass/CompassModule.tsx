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

export function CompassLayout() {
  return <AppShell><Outlet /></AppShell>
}

export { HoyView, RealFrentesView, RealFrenteDetailView, TareasView, CalendarioView, BandejaView, IdeasView, DecisionesView, RevisionSemanalView }
