import type { BrandDefinition } from './types';

/**
 * Marca default. Los valores reproducen exactamente la apariencia actual;
 * `brandParity.test.ts` lo verifica contra el fixture congelado.
 */
export const emphasysBrand: BrandDefinition = {
  id: 'emphasys',
  name: 'Emphasys',
  colors: {
    blue: {
      base: '#1d2f68',
      hover: '#162551',
      tint: '#eef2ff',
      wash: '#e7eef8',
    },
    graphite: {
      chrome: '#2c3344',
      raised: '#3c4149',
      raisedForeground: '#f4f0e8',
      deep: '#2c3138',
      selection: '#5e6672',
      itemForeground: '#efe6d8',
      accent: '#d7cbbd',
    },
    beige: {
      base: '#f4f0e8',
      hover: '#efe8dc',
      border: '#e4ddd2',
      tint: '#efe4d4',
    },
    ivory: {
      surface: '#f7f4ee',
      elevated: '#fffaf2',
      well: '#fffcf8',
      selected: '#fbf7f1',
    },
    ink: {
      primary: '#3e3428',
      secondary: '#5c5348',
      muted: '#7a7268',
    },
    accent: '#006261',
  },
  typography: {
    functional: "Roboto, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
    navigation: '"Source Sans 3", system-ui, sans-serif',
    editorialFigure:
      '"Iowan Old Style", Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif',
  },
  assets: {
    logo: 'emphasys-w.png',
    logoMark: 'emphasys-colibri-w.png',
    favicon: '/favicon.ico',
    appleTouchIcon: '/emphazul_180.png',
    manifest: '/manifest.webmanifest',
    icons: {
      16: '/emphazul_16.png',
      32: '/emphazul_32.png',
      48: '/emphazul_48.png',
      64: '/emphazul_64.png',
      128: '/emphazul_128.png',
      180: '/emphazul_180.png',
      192: '/emphazul_192.png',
      256: '/emphazul_256.png',
      512: '/emphazul_512.png',
    },
  },
  metadata: {
    title: 'Emphasys Plataforma Integral de Negocios',
    appName: 'Emphasys ERP',
    shortName: 'Emphasys',
    description: 'Plataforma integral de negocios Emphasys',
    themeColor: '#1d2f68',
    backgroundColor: '#ffffff',
  },
};
