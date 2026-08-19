import type { ActividadEstado } from "../../../services/compassService"

/**
 * Traducción visual de los 5 estados reales de Actividad. Cada estado se
 * distingue por glifo + estilo de borde + relleno — nunca solo por color —
 * para que siga siendo legible con el color del Frente de fondo.
 */
export const ESTADO_LABEL: Record<ActividadEstado, string> = {
  programada: "Programada",
  realizada: "Realizada",
  parcial: "Parcial",
  no_realizada: "No realizada",
  cancelada: "Cancelada",
}

export const ESTADO_GLYPH: Record<ActividadEstado, string> = {
  programada: "○",
  realizada: "✓",
  parcial: "◐",
  no_realizada: "✕",
  cancelada: "⊘",
}

export type DecoracionEstado = {
  border: string
  background: string
  textoAtenuado: boolean
  tachado: boolean
}

export function decoracionEstado(estado: ActividadEstado, colorFrente: string): DecoracionEstado {
  switch (estado) {
    case "programada":
      return { border: `1.5px solid ${colorFrente}`, background: "var(--card)", textoAtenuado: false, tachado: false }
    case "realizada":
      return { border: `1px solid ${colorFrente}`, background: `color-mix(in oklch, ${colorFrente}, var(--card) 80%)`, textoAtenuado: false, tachado: false }
    case "parcial":
      return {
        border: `1px solid ${colorFrente}`,
        background: `linear-gradient(180deg, color-mix(in oklch, ${colorFrente}, var(--card) 80%) 0 52%, var(--card) 52% 100%)`,
        textoAtenuado: false,
        tachado: false,
      }
    case "no_realizada":
      return { border: `1.5px dashed ${colorFrente}`, background: "var(--card)", textoAtenuado: true, tachado: false }
    case "cancelada":
      return {
        border: "1px solid var(--border)",
        background: "repeating-linear-gradient(135deg, var(--surface-sunken) 0 5px, var(--card) 5px 10px)",
        textoAtenuado: true,
        tachado: true,
      }
  }
}
