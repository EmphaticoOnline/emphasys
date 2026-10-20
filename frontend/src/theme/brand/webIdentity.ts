import type { BrandDefinition } from './types.ts';

/**
 * Identidad web derivada de la marca: placeholders de `index.html` y el
 * Web App Manifest. Lo consume el plugin de `vite.config.ts` en dev y build.
 *
 * Los placeholders usan `__BRAND_*__` y no `%...%` porque Vite reserva esa
 * sintaxis para variables de entorno en `index.html`.
 */
export function brandHtmlReplacements(brand: BrandDefinition): Record<string, string> {
  const { assets, metadata } = brand;
  return {
    __BRAND_TITLE__: metadata.title,
    __BRAND_FAVICON__: assets.favicon,
    __BRAND_ICON_32__: assets.icons[32],
    __BRAND_ICON_192__: assets.icons[192],
    __BRAND_APPLE_TOUCH_ICON__: assets.appleTouchIcon,
    __BRAND_MANIFEST__: assets.manifest,
    __BRAND_THEME_COLOR__: metadata.themeColor,
    __BRAND_SHORT_NAME__: metadata.shortName,
  };
}

export function renderBrandHtml(template: string, brand: BrandDefinition): string {
  let html = template;
  for (const [placeholder, value] of Object.entries(brandHtmlReplacements(brand))) {
    html = html.replaceAll(placeholder, value);
  }
  const leftover = html.match(/__BRAND_[A-Z0-9_]+__/);
  if (leftover) {
    throw new Error(`Placeholder de marca sin valor en index.html: ${leftover[0]}`);
  }
  return html;
}

const MANIFEST_ICON_SIZES = [192, 512] as const;

export function renderWebManifest(brand: BrandDefinition): string {
  const { assets, metadata } = brand;
  const manifest = {
    name: metadata.appName,
    short_name: metadata.shortName,
    description: metadata.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: metadata.backgroundColor,
    theme_color: metadata.themeColor,
    icons: MANIFEST_ICON_SIZES.map((size) => ({
      src: assets.icons[size],
      sizes: `${size}x${size}`,
      type: 'image/png',
    })),
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
