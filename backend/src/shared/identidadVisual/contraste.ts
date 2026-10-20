/**
 * Identidad visual por empresa: formato y contraste (WCAG 2.x) de los tres
 * colores personalizables. Módulo puro y sin imports: lo usan el backend
 * (validación del PUT) y el frontend (indicadores de la pantalla de identidad).
 */

export const ROLES_IDENTIDAD = ['primario', 'acento', 'sidebar'] as const;
export type RolIdentidad = (typeof ROLES_IDENTIDAD)[number];

/**
 * Identidad de Emphasys: la que se aplica cuando un color es NULL.
 * Deben coincidir con `emphasysBrand` del frontend (blue.base, accent,
 * graphite.chrome); una prueba del frontend lo verifica.
 */
export const IDENTIDAD_EMPHASYS: Readonly<Record<RolIdentidad, string>> = {
  primario: '#1d2f68',
  acento: '#006261',
  sidebar: '#2c3344',
};

/**
 * Colores fijos contra los que se mide cada rol. `marfil` y `beige` son
 * ivory.surface y beige.base de Emphasys (la prueba del frontend lo verifica).
 */
export const FONDOS_REFERENCIA = {
  blanco: '#ffffff',
  marfil: '#f7f4ee',
  beige: '#f4f0e8',
} as const;
export type FondoReferencia = keyof typeof FONDOS_REFERENCIA;

/**
 * Reglas aprobadas (E3). Todas piden 4.5:1 porque cada color se usa también
 * como texto de tamaño normal:
 * - primario: texto blanco de los botones (D-B1) y títulos sobre blanco;
 * - sidebar: texto marfil del menú;
 * - acento: texto e indicadores sobre superficies claras (peor caso de las tres).
 */
export const REGLAS_CONTRASTE: Readonly<Record<RolIdentidad, { contra: readonly FondoReferencia[]; minimo: number }>> = {
  primario: { contra: ['blanco'], minimo: 4.5 },
  sidebar: { contra: ['marfil'], minimo: 4.5 },
  acento: { contra: ['blanco', 'marfil', 'beige'], minimo: 4.5 },
};

/** `#RRGGBB` (mayúsculas o minúsculas) → `#rrggbb`; cualquier otra cosa → null. */
export function normalizarHex(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return /^#[0-9a-fA-F]{6}$/.test(limpio) ? limpio.toLowerCase() : null;
}

/** Luminancia relativa WCAG de un `#rrggbb`. */
export function luminanciaRelativa(hex: string): number {
  const canal = (inicio: number) => {
    const c = Number.parseInt(hex.slice(inicio, inicio + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

/** Razón de contraste WCAG entre dos `#rrggbb` (1 a 21). */
export function razonContraste(a: string, b: string): number {
  const [claro, oscuro] = [luminanciaRelativa(a), luminanciaRelativa(b)].sort((x, y) => y - x);
  return (claro! + 0.05) / (oscuro! + 0.05);
}

export type ErrorContraste = {
  color: RolIdentidad;
  valor: string;
  contra: FondoReferencia;
  ratio: number;
  minimo: number;
};

/** Contraste de cada color dado (ya normalizado) contra sus fondos de referencia. */
export function validarContraste(colores: Partial<Record<RolIdentidad, string | null>>): ErrorContraste[] {
  const errores: ErrorContraste[] = [];
  for (const color of ROLES_IDENTIDAD) {
    const valor = colores[color];
    if (!valor) continue;
    const { contra, minimo } = REGLAS_CONTRASTE[color];
    for (const fondo of contra) {
      const ratio = razonContraste(valor, FONDOS_REFERENCIA[fondo]);
      if (ratio < minimo) errores.push({ color, valor, contra: fondo, ratio: Math.round(ratio * 100) / 100, minimo });
    }
  }
  return errores;
}
