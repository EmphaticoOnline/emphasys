import type { BrandDefinition } from './types';

/** Default brand. Values intentionally mirror the current Emphasys UI. */
export const emphasysBrand: BrandDefinition = {
  id: 'emphasys',
  name: 'Emphasys',
  primitives: {
    brand: {
      900: '#1d2f68',
      800: '#162551',
      100: '#e7eef8',
      50: '#eef2ff',
    },
    chrome: {
      base: '#2c3344',
      raised: '#3c4149',
      deep: '#2c3138',
    },
    neutralWarm: {
      background: '#f4f0e8',
      foreground: '#3e3428',
      border: '#e4ddd2',
      selected: '#fbf7f1',
    },
    neutralCool: {
      background: '#ffffff',
      foreground: '#1f2937',
      border: '#e5e7eb',
      selected: '#ffffff',
    },
    accent: '#006261',
    categorical: ['#1d2f68', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#0369a1', '#4d7c0f', '#a21caf'],
  },
  typography: {
    body: "Roboto, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
    nav: 'Source Sans 3',
    figure: 'Iowan Old Style',
    mono: 'monospace',
  },
  assets: {
    logoFull: 'src/assets/emphasys-w.png',
    logoMark: 'src/assets/emphasys-colibri-w.png',
    favicon: 'public/favicon.ico',
  },
  meta: {
    themeColor: '#2c3344',
    manifestName: 'Emphasys',
    shortName: 'Emphasys',
  },
};
