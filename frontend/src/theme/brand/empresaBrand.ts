import {
  razonContraste,
  validarContraste,
  type RolIdentidad,
} from '../../../../backend/src/shared/identidadVisual/contraste.ts';
import { activeBrand } from './active.ts';
import type { BrandDefinition } from './types.ts';

/**
 * Marca de una empresa: la marca base (Emphasys) con sus tres colores
 * personalizados. Solo cambian las familias de esos roles; tipografía, assets,
 * metadata web, beige, marfil y tinta siguen siendo los de la base.
 *
 * - primario → `blue.*` (base, hover, tint, wash)
 * - sidebar  → `graphite.*` (chrome y sus derivados, incluido `graphite.accent`)
 * - acento   → `accent`
 *
 * Un color en null conserva la familia de la base. Sin ningún color devuelve el
 * mismo objeto base, así que los temas de Emphasys se reutilizan sin cambios.
 */
export type ColoresEmpresa = Record<RolIdentidad, string | null>;

const cache = new Map<string, BrandDefinition>();

type Rgb = [number, number, number];
const aRgb = (hex: string): Rgb => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const aHex = (rgb: Rgb) => `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;

/** Mezcla en sRGB: `peso` es la proporción de `con` (0 = `color`, 1 = `con`). */
export function mezclar(color: string, con: string, peso: number): string {
  const a = aRgb(color);
  const b = aRgb(con);
  return aHex([0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * peso) as Rgb);
}

/** Oscurece `color` en pasos hasta que `texto` tenga al menos `minimo` de contraste sobre él. */
export function oscurecerHastaContraste(color: string, texto: string, minimo: number): string {
  let actual = color;
  for (let paso = 0; paso < 30 && razonContraste(actual, texto) < minimo; paso += 1) {
    actual = mezclar(actual, '#000000', 0.08);
  }
  return actual;
}

/** Descarta los colores que no cumplen las reglas del servidor (dato viejo o alterado): ese rol queda en la base. */
export function coloresValidos(colores: Partial<ColoresEmpresa> | null | undefined): ColoresEmpresa {
  const hex = (valor: unknown) => (typeof valor === 'string' && /^#[0-9a-f]{6}$/.test(valor) ? valor : null);
  const limpios: ColoresEmpresa = {
    primario: hex(colores?.primario),
    acento: hex(colores?.acento),
    sidebar: hex(colores?.sidebar),
  };
  for (const { color } of validarContraste(limpios)) limpios[color] = null;
  return limpios;
}

function derivar(base: BrandDefinition, { primario, acento, sidebar }: ColoresEmpresa): BrandDefinition {
  const { ivory, beige } = base.colors;
  const blue = primario
    ? {
        base: primario,
        hover: mezclar(primario, '#000000', 0.22),
        tint: mezclar(primario, '#ffffff', 0.93),
        wash: mezclar(primario, '#ffffff', 0.9),
      }
    : base.colors.blue;
  const graphite = sidebar
    ? {
        chrome: sidebar,
        // Botón primario y encabezados del experimental: texto beige encima.
        raised: oscurecerHastaContraste(mezclar(sidebar, '#ffffff', 0.07), beige.base, 4.5),
        deep: mezclar(sidebar, '#000000', 0.1),
        // Selección del menú: texto marfil encima.
        selection: oscurecerHastaContraste(mezclar(sidebar, '#ffffff', 0.22), ivory.selected, 4.5),
        itemForeground:
          razonContraste(base.colors.graphite.itemForeground, sidebar) >= 4.5 ? base.colors.graphite.itemForeground : ivory.surface,
        // Acento claro dentro del sidebar (decisión E3: se deriva del sidebar).
        accent: mezclar(ivory.surface, sidebar, 0.15),
      }
    : base.colors.graphite;
  return {
    ...base,
    id: `${base.id}+empresa`,
    colors: { ...base.colors, blue, graphite, accent: acento ?? base.colors.accent },
  };
}

/** Marca para los colores de una empresa; misma instancia para los mismos colores. */
export function getEmpresaBrand(colores: Partial<ColoresEmpresa> | null | undefined, base: BrandDefinition = activeBrand): BrandDefinition {
  const limpios = coloresValidos(colores);
  if (!limpios.primario && !limpios.acento && !limpios.sidebar) return base;
  const clave = `${base.id}|${limpios.primario}|${limpios.acento}|${limpios.sidebar}`;
  let marca = cache.get(clave);
  if (!marca) {
    marca = derivar(base, limpios);
    cache.set(clave, marca);
  }
  return marca;
}
