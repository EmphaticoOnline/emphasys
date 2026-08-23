import { sumarDias } from "@/lib/calendario-fechas"

/** "hace 1 semana" / "hace 3 meses", derivado de la fecha real de cierre. */
export function relativoDesde(fechaRevisionIso: string) {
  const ahora = Date.now()
  const cierre = new Date(fechaRevisionIso).getTime()
  const semanas = Math.floor((ahora - cierre) / (7 * 86_400_000))
  if (semanas <= 0) return "esta semana"
  if (semanas === 1) return "hace 1 semana"
  if (semanas < 9) return `hace ${semanas} semanas`
  const meses = Math.max(2, Math.round(semanas / 4.35))
  return `hace ${meses} meses`
}

/** Cuántos días después del fin de la semana se cerró la revisión, derivado de semana_inicio + fecha_revision reales. */
export function desfaseCierre(semanaInicio: string, fechaRevisionIso: string) {
  const finSemana = new Date(`${sumarDias(semanaInicio, 6)}T00:00:00`).getTime()
  const cierre = new Date(fechaRevisionIso).getTime()
  const dias = Math.round((cierre - finSemana) / 86_400_000)
  if (dias <= 0) return "cerrada dentro de la semana"
  if (dias === 1) return "un día después del cierre"
  return `${dias} días después del cierre`
}
