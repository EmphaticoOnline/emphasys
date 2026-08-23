import type { Congruencia, ExpectativaAtencion, IntencionPrioridad } from "../../../services/compassService"

export const congruenciaLabel: Record<Congruencia, string> = {
  congruente: "Congruente",
  en_riesgo: "En riesgo",
  descuidado: "Descuidado",
  sobreatendido: "Sobreatendido",
}

export const congruenciaToken: Record<Congruencia, string> = {
  congruente: "--congruent",
  en_riesgo: "--at-risk",
  descuidado: "--neglected",
  sobreatendido: "--overattended",
}

export const prioridadLabel: Record<IntencionPrioridad, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
}

export const expectativaLabel: Record<ExpectativaAtencion, string> = {
  sin_compromiso: "Sin compromiso",
  atender: "Atender",
  prioritario: "Prioritario",
}

export function notaCongruencia(sugerida: Congruencia | null, confirmada: Congruencia | "" | null) {
  if (!confirmada) return "Sin confirmar. La sugerencia es una lectura, no un veredicto."
  if (!sugerida) return `Registraste ${congruenciaLabel[confirmada]} sin una sugerencia previa.`
  if (confirmada === sugerida) return "Confirmaste la lectura sugerida."
  return `Ajustaste la congruencia: sugerida ${congruenciaLabel[sugerida]} → confirmada ${congruenciaLabel[confirmada]}.`
}
