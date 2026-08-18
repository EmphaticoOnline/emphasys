import { CalendarDays, Compass, Gavel, Inbox, LayoutGrid, Lightbulb, ListChecks, ScrollText } from "lucide-react"

export const navPrincipal = [
  { href: "/compass", label: "Hoy", icon: Compass },
  { href: "/compass/frentes", label: "Frentes", icon: LayoutGrid },
  { href: "/compass/tareas", label: "Tareas", icon: ListChecks },
  { href: "/compass/calendario", label: "Calendario", icon: CalendarDays },
]

export const navSecundaria = [
  { href: "/compass/bandeja", label: "Bandeja", icon: Inbox },
  { href: "/compass/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/compass/decisiones", label: "Decisiones", icon: Gavel },
  { href: "/compass/revision-semanal", label: "Revisión semanal", icon: ScrollText },
]

export const navTodo = [...navPrincipal, ...navSecundaria]
