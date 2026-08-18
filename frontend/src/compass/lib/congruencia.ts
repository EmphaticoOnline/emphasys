import type { EstadoCongruencia, Expectativa, IntencionSemanal, MedicionSemanal } from "./types"

/**
 * Sugiere un estado de congruencia. Es solo una sugerencia: la persona
 * puede confirmarla o interpretarla de otra manera. Más tiempo no
 * siempre significa mejor — un exceso también se marca como desviación.
 */
export function sugerirCongruencia(
  intencion: Pick<IntencionSemanal, "horasObjetivo" | "expectativa"> | undefined,
  medicion: Pick<MedicionSemanal, "horasEfectivas"> | undefined,
): EstadoCongruencia {
  const efectivas = medicion?.horasEfectivas ?? 0
  const objetivo = intencion?.horasObjetivo

  if (objetivo && objetivo > 0) {
    const ratio = efectivas / objetivo
    if (ratio >= 1.4) return "Sobreatendido"
    if (ratio >= 0.85) return "Congruente"
    if (ratio >= 0.45) return "En riesgo"
    return "Descuidado"
  }

  const expectativa: Expectativa = intencion?.expectativa ?? "Atender"
  if (expectativa === "Sin compromiso") return "Congruente"
  if (expectativa === "Prioritario") {
    if (efectivas >= 4) return "Congruente"
    if (efectivas >= 1) return "En riesgo"
    return "Descuidado"
  }
  // Atender
  if (efectivas >= 2) return "Congruente"
  if (efectivas >= 0.5) return "En riesgo"
  return "Descuidado"
}

export const congruenciaLabel: Record<EstadoCongruencia, string> = {
  Congruente: "Congruente",
  "En riesgo": "En riesgo",
  Descuidado: "Descuidado",
  Sobreatendido: "Sobreatendido",
}

export const congruenciaColorVar: Record<EstadoCongruencia, string> = {
  Congruente: "var(--congruent)",
  "En riesgo": "var(--at-risk)",
  Descuidado: "var(--neglected)",
  Sobreatendido: "var(--overattended)",
}

export const congruenciaDescripcion: Record<EstadoCongruencia, string> = {
  Congruente: "El tiempo dedicado coincide con lo que declaraste importante.",
  "En riesgo": "La atención se está alejando de la intención declarada.",
  Descuidado: "Este frente recibió menos atención de la esperada.",
  Sobreatendido: "Recibió más tiempo del previsto. Vale la pena revisar si fue intencional.",
}
