/**
 * Neutrales estructurales escritos a mano en componentes del tema clásico:
 * bordes, textos secundarios y fondos suaves. Son las escalas gray y slate de
 * Tailwind con su número de tono, más los azul-grises propios de Emphasys, para
 * conservar cada valor exacto.
 *
 * No dependen de la marca: si una marca futura necesita otros neutrales, se
 * derivarán aquí de forma explícita. Tampoco son los roles de `EmphasysTokens`
 * (`content.border`, `content.muted`…), que cambian con el tema experimental.
 */
export const neutralColors = {
  gray: {
    200: '#e5e7eb',
    300: '#d1d5db',
    500: '#6b7280',
    900: '#111827',
  },
  slate: {
    50: '#f8fafc',
    300: '#cbd5e1',
    400: '#94a3b8',
    600: '#475569',
    900: '#0f172a',
  },
  /** Azul-grises propios de Emphasys (no son de Tailwind). */
  steel: {
    /** Borde de controles flotantes sobre fondo claro. */
    line: '#dbe3f0',
  },
} as const;
