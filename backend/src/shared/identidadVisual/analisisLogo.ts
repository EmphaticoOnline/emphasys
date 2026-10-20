import {
  FONDOS_REFERENCIA,
  razonContraste,
  REGLAS_CONTRASTE,
  validarContraste,
  type RolIdentidad,
} from './contraste';

/**
 * Análisis de un logotipo para proponer primario, acento y sidebar. Módulo puro:
 * recibe píxeles RGBA ya decodificados (el servicio usa sharp) y no usa IA.
 *
 * 1. Fondo: transparente, o el color dominante del borde de la imagen.
 * 2. Primer plano: píxeles opacos que no son fondo ni blanco/casi blanco.
 * 3. Colores: los cromáticos se agrupan por tono (OKLCH, 24 sectores) y se
 *    ponderan por cantidad de píxeles.
 * 4. Roles: primario = grupo dominante; acento = siguiente grupo con tono
 *    distinto (o una variante del primario); sidebar = oscuro y poco saturado,
 *    derivado del primario.
 * 5. Contraste: cada rol se oscurece en OKLCH hasta cumplir REGLAS_CONTRASTE.
 * 6. Calidad: sin suficientes píxeles cromáticos → 'sin_colores_utiles'.
 */
export const ALGORITMO_VERSION = 1;

export type ImagenRgba = { width: number; height: number; data: Uint8Array | Uint8ClampedArray };

export type ResultadoAnalisis =
  | { estado: 'ok'; colores: Record<RolIdentidad, string>; confianza: number; detalle: Record<string, unknown> }
  | { estado: 'sin_colores_utiles'; confianza: number; detalle: Record<string, unknown> };

// ── Color ─────────────────────────────────────────────────────────────────────

type Rgb = [number, number, number];
type Oklch = { L: number; C: number; h: number };

const aLineal = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const aSrgb = (v: number) => {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
};

export function rgbAOklch([r, g, b]: Rgb): Oklch {
  const [lr, lg, lb] = [aLineal(r), aLineal(g), aLineal(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(bb, a) * 180) / Math.PI;
  return { L, C: Math.hypot(a, bb), h: h < 0 ? h + 360 : h };
}

export function oklchARgb({ L, C, h }: Oklch): Rgb {
  const rad = (h * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    aSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    aSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    aSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const aHex = (rgb: Rgb) => `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
const deHex = (hex: string): Rgb => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const distancia = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const difTono = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** Baja la luminosidad OKLCH hasta que el color cumpla su regla de contraste. */
function ajustarContraste(rol: RolIdentidad, color: Oklch): { hex: string; pasos: number } {
  const { contra, minimo } = REGLAS_CONTRASTE[rol];
  const cumple = (hex: string) => contra.every((fondo) => razonContraste(hex, FONDOS_REFERENCIA[fondo]) >= minimo);
  let actual = { ...color };
  let hex = aHex(oklchARgb(actual));
  let pasos = 0;
  while (!cumple(hex) && actual.L > 0.05 && pasos < 60) {
    actual = { ...actual, L: actual.L - 0.015 };
    hex = aHex(oklchARgb(actual));
    pasos += 1;
  }
  return { hex, pasos };
}

// ── Análisis ──────────────────────────────────────────────────────────────────

const SECTORES = 24;
const ALFA_MINIMA = 128;
const CROMA_MINIMA = 0.045;

export function analizarLogo({ width, height, data }: ImagenRgba): ResultadoAnalisis {
  const total = width * height;
  const pixel = (i: number): [Rgb, number] => [[data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!], data[i * 4 + 3]!];

  // 1. Fondo por el borde.
  const borde: number[] = [];
  for (let x = 0; x < width; x += 1) borde.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y += 1) borde.push(y * width, y * width + width - 1);
  let transparentes = 0;
  const conteoBorde = new Map<string, { n: number; rgb: Rgb }>();
  for (const i of borde) {
    const [rgb, alfa] = pixel(i);
    if (alfa < ALFA_MINIMA) {
      transparentes += 1;
      continue;
    }
    const clave = rgb.map((c) => c >> 4).join(',');
    const previo = conteoBorde.get(clave);
    conteoBorde.set(clave, { n: (previo?.n ?? 0) + 1, rgb: previo?.rgb ?? rgb });
  }
  const dominanteBorde = [...conteoBorde.values()].sort((a, b) => b.n - a.n)[0];
  const fondo: Rgb | null =
    transparentes / borde.length >= 0.5 || !dominanteBorde || dominanteBorde.n / borde.length < 0.5 ? null : dominanteBorde.rgb;

  // 2-3. Primer plano y grupos por tono.
  const sectores = Array.from({ length: SECTORES }, () => ({ n: 0, L: 0, C: 0, x: 0, y: 0 }));
  let primerPlano = 0;
  let cromaticos = 0;
  for (let i = 0; i < total; i += 1) {
    const [rgb, alfa] = pixel(i);
    if (alfa < ALFA_MINIMA) continue;
    if (fondo && distancia(rgb, fondo) < 40) continue;
    const color = rgbAOklch(rgb);
    if (color.L > 0.94 && color.C < 0.03) continue; // blanco o casi blanco (texto o realce)
    primerPlano += 1;
    if (color.C < CROMA_MINIMA) continue; // gris o negro: no aporta tono
    cromaticos += 1;
    const sector = sectores[Math.floor(color.h / (360 / SECTORES)) % SECTORES]!;
    const rad = (color.h * Math.PI) / 180;
    sector.n += 1;
    sector.L += color.L;
    sector.C += color.C;
    sector.x += Math.cos(rad);
    sector.y += Math.sin(rad);
  }

  const candidatos = sectores
    .filter((s) => s.n > 0)
    .map((s) => {
      const h = (Math.atan2(s.y, s.x) * 180) / Math.PI;
      const color = { L: s.L / s.n, C: s.C / s.n, h: h < 0 ? h + 360 : h };
      return { color, peso: s.n / Math.max(1, cromaticos), hex: aHex(oklchARgb(color)) };
    })
    .sort((a, b) => b.peso - a.peso);

  const proporcionCromatica = primerPlano ? cromaticos / primerPlano : 0;
  const detalleBase = {
    version: ALGORITMO_VERSION,
    fondo: fondo ? aHex(fondo) : 'transparente',
    pixeles: { total, primerPlano, cromaticos },
    candidatos: candidatos.slice(0, 5).map(({ hex, peso, color }) => ({ hex, peso: Math.round(peso * 1000) / 1000, tono: Math.round(color.h) })),
  };

  // 6. Calidad mínima: algo de primer plano y algo de color.
  if (primerPlano < total * 0.01 || cromaticos < Math.max(12, primerPlano * 0.05) || !candidatos.length) {
    return { estado: 'sin_colores_utiles', confianza: 0, detalle: { ...detalleBase, motivo: 'El logotipo no tiene colores útiles (monocromático, vacío o casi blanco).' } };
  }

  // 4. Roles.
  const principal = candidatos[0]!;
  const segundo = candidatos.find((c) => c !== principal && c.peso >= 0.05 && difTono(c.color.h, principal.color.h) >= 40);
  const baseAcento: Oklch = segundo
    ? segundo.color
    : { L: Math.min(0.6, principal.color.L + 0.12), C: principal.color.C * 0.8, h: (principal.color.h + 30) % 360 };
  const baseSidebar: Oklch = { L: 0.27, C: Math.min(principal.color.C * 0.35, 0.05), h: principal.color.h };

  // 5. Contraste.
  const primario = ajustarContraste('primario', principal.color);
  const acento = ajustarContraste('acento', baseAcento);
  const sidebar = ajustarContraste('sidebar', baseSidebar);
  const colores = { primario: primario.hex, acento: acento.hex, sidebar: sidebar.hex };
  if (validarContraste(colores).length) {
    return { estado: 'sin_colores_utiles', confianza: 0, detalle: { ...detalleBase, motivo: 'No se pudo ajustar el contraste.' } };
  }

  const confianza = Math.round((0.5 * Math.min(1, proporcionCromatica / 0.3) + 0.5 * principal.peso) * 1000) / 1000;
  return {
    estado: 'ok',
    colores,
    confianza,
    detalle: {
      ...detalleBase,
      acentoDesde: segundo ? 'segundo_color' : 'variante_del_primario',
      ajustes: {
        primario: { original: principal.hex, final: primario.hex, pasos: primario.pasos },
        acento: { original: aHex(oklchARgb(baseAcento)), final: acento.hex, pasos: acento.pasos },
        sidebar: { original: aHex(oklchARgb(baseSidebar)), final: sidebar.hex, pasos: sidebar.pasos },
      },
      contraste: {
        blancoSobrePrimario: Math.round(razonContraste('#ffffff', primario.hex) * 100) / 100,
        marfilSobreSidebar: Math.round(razonContraste(FONDOS_REFERENCIA.marfil, sidebar.hex) * 100) / 100,
        acentoSobreBeige: Math.round(razonContraste(acento.hex, FONDOS_REFERENCIA.beige) * 100) / 100,
      },
    },
  };
}

/** Utilidad para pruebas y diagnóstico: RGB de un hex. */
export const hexARgb = deHex;
