/**
 * Los Frentes reales no traen un color propio desde el backend. Se les asigna
 * un tono estable ciclando los 5 tokens --chart-1..5 (misma L y C, distinto
 * matiz) según su posición en la lista de Frentes ya cargada — así el mismo
 * Frente siempre pinta igual mientras esa lista no cambie de orden.
 */
export const paletaColoresFrente = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const

export function colorTokenDeFrente(frentesOrdenados: { id: number }[], frenteId: number | null | undefined): string | null {
  if (frenteId == null) return null
  const index = frentesOrdenados.findIndex((f) => f.id === frenteId)
  if (index === -1) return null
  return paletaColoresFrente[index % paletaColoresFrente.length]!
}

export function colorVarDeFrente(frentesOrdenados: { id: number }[], frenteId: number | null | undefined): string {
  const token = colorTokenDeFrente(frentesOrdenados, frenteId)
  return token ? `var(--${token})` : "var(--muted-foreground)"
}
