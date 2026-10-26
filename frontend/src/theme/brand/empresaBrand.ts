import {
  luminanciaRelativa,
  razonContraste,
  validarContraste,
  textoSobreSuperficieSecundaria,
  textoSobrePrimario,
  textoSobreSidebar,
  type RolIdentidad,
} from '../../../../backend/src/shared/identidadVisual/contraste.ts';
import { activeBrand } from './active.ts';
import { emphasysBrand } from './emphasys.ts';
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
export type ColoresEmpresa = Record<RolIdentidad, string | null> & { superficie_secundaria: string | null };
export type ModoIdentidad = 'emphasys' | 'personalizado';

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

/** Fondo de selección sobre un Sidebar con texto oscuro: lo oscurece sin perder 4.5:1 con ese texto. */
function ajustarSeleccion(sidebar: string, texto: string): string {
  for (let peso = 0.2; peso > 0; peso -= 0.04) {
    const candidato = mezclar(sidebar, texto, peso);
    if (razonContraste(candidato, texto) >= 4.5) return candidato;
  }
  return sidebar;
}

/** Descarta los colores que no cumplen las reglas del servidor (dato viejo o alterado): ese rol queda en la base. */
export function coloresValidos(colores: Partial<ColoresEmpresa> | null | undefined): ColoresEmpresa {
  const hex = (valor: unknown) => (typeof valor === 'string' && /^#[0-9a-f]{6}$/.test(valor) ? valor : null);
  const limpios: ColoresEmpresa = {
    primario: hex(colores?.primario),
    acento: hex(colores?.acento),
    sidebar: hex(colores?.sidebar),
    superficie_secundaria: hex(colores?.superficie_secundaria),
  };
  for (const { color } of validarContraste(limpios)) limpios[color] = null;
  return limpios;
}

function derivar(base: BrandDefinition, { primario, acento, sidebar, superficie_secundaria }: ColoresEmpresa): BrandDefinition {
  const { ivory, beige } = base.colors;
  const textoPrimario = primario ? textoSobrePrimario(primario) : null;
  const blue = primario
    ? {
        base: primario,
        foreground: textoPrimario!,
        // Con texto oscuro el hover aclara: oscurecerlo restaría contraste.
        hover: textoPrimario === '#ffffff' ? mezclar(primario, '#000000', 0.22) : mezclar(primario, '#ffffff', 0.18),
        tint: mezclar(primario, '#ffffff', 0.93),
        wash: mezclar(primario, '#ffffff', 0.9),
      }
    : base.colors.blue;
  const textoSidebar = sidebar ? textoSobreSidebar(sidebar) : null;
  // Sidebar claro: su texto es oscuro y las derivaciones (raised, selección, acento) oscurecen en lugar de aclarar.
  const sidebarClaro = Boolean(textoSidebar) && luminanciaRelativa(textoSidebar!) < 0.3;
  // La superficie secundaria solo cambia con su propio color; sin él es la de Emphasys, no se deriva del Sidebar.
  const raised = superficie_secundaria ?? base.colors.graphite.raised;
  const graphite = sidebar || superficie_secundaria
    ? {
        chrome: sidebar ?? base.colors.graphite.chrome,
        // Sin Sidebar propio el cromado conserva el texto beige de la base.
        chromeForeground: textoSidebar ?? base.colors.graphite.raisedForeground,
        // Botón primario y encabezados del experimental: texto automático encima.
        raised,
        raisedForeground: textoSobreSuperficieSecundaria(raised),
        // Hover de la superficie elevada: sigue a la superficie efectiva, no al Sidebar.
        deep: superficie_secundaria ? mezclar(superficie_secundaria, '#000000', 0.25) : base.colors.graphite.deep,
        // Selección del menú: texto automático encima.
        selection: sidebar ? (sidebarClaro ? ajustarSeleccion(sidebar, textoSidebar!) : oscurecerHastaContraste(mezclar(sidebar, '#ffffff', 0.22), ivory.selected, 4.5)) : base.colors.graphite.selection,
        itemForeground:
          sidebar && razonContraste(base.colors.graphite.itemForeground, sidebar) < 4.5 ? textoSidebar! : base.colors.graphite.itemForeground,
        // Acento claro dentro del sidebar (decisión E3: se deriva del sidebar).
        accent: sidebar ? mezclar(textoSidebar!, sidebar, 0.15) : base.colors.graphite.accent,
      }
    : base.colors.graphite;
  return {
    ...base,
    id: `${base.id}+empresa`,
    colors: { ...base.colors, blue, graphite, accent: acento ?? base.colors.accent },
  };
}

/** Marca para los colores de una empresa; misma instancia para los mismos colores. */
export function getEmpresaBrand(colores: Partial<ColoresEmpresa> | null | undefined, base: BrandDefinition = activeBrand, modo: ModoIdentidad = 'personalizado'): BrandDefinition {
  if (modo === 'emphasys') return emphasysBrand;
  const limpios = coloresValidos(colores);
  if (!limpios.primario && !limpios.acento && !limpios.sidebar && !limpios.superficie_secundaria) return base;
  const clave = `${base.id}|${limpios.primario}|${limpios.acento}|${limpios.sidebar}|${limpios.superficie_secundaria}`;
  let marca = cache.get(clave);
  if (!marca) {
    marca = derivar(base, limpios);
    cache.set(clave, marca);
  }
  return marca;
}
