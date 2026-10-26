const ALPHA_MIN = 32;
const MIN_CONTRAST = 4.5;

function luminance(r: number, g: number, b: number): number {
  const linear = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const l1 = luminance(...a);
  const l2 = luminance(...b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function hexRgb(hex: string): [number, number, number] | null {
  const value = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16)) as [number, number, number];
}

/**
 * Decide from visible RGBA pixels, rather than an average logo color. The
 * transparent margin is ignored and a small amount of antialiasing is kept.
 */
export function logoNeedsContrastProtection(image: HTMLImageElement, sidebar: string): boolean {
  const background = hexRgb(sidebar);
  if (!background || !image.naturalWidth || !image.naturalHeight) return false;
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 96 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return false;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let visible = 0;
  let insufficient = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]!;
    if (alpha < ALPHA_MIN) continue;
    visible += 1;
    const effective: [number, number, number] = [
      Math.round((data[i]! * alpha + background[0] * (255 - alpha)) / 255),
      Math.round((data[i + 1]! * alpha + background[1] * (255 - alpha)) / 255),
      Math.round((data[i + 2]! * alpha + background[2] * (255 - alpha)) / 255),
    ];
    if (contrast([data[i]!, data[i + 1]!, data[i + 2]!], background) < MIN_CONTRAST && contrast(effective, background) < MIN_CONTRAST) {
      insufficient += 1;
    }
  }
  // Require a meaningful visible portion to fail; isolated antialiasing pixels
  // must not introduce a white plate around an otherwise readable logo.
  return visible > 0 && insufficient / visible >= 0.05;
}

const cache = new Map<string, boolean>();

export function readLogoContrastCache(logo: string, sidebar: string): boolean | undefined {
  return cache.get(`${logo}|${sidebar}`);
}

export function writeLogoContrastCache(logo: string, sidebar: string, value: boolean): void {
  cache.set(`${logo}|${sidebar}`, value);
}
