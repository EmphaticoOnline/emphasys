import { emphasysBrand } from '../brand/emphasys.ts';
import type { BrandDefinition } from '../brand/types.ts';

/**
 * Marca de prueba para la validación white label de punta a punta.
 *
 * - Todos sus colores son distintos de los de Emphasys y distintos entre sí, para
 *   que cualquier valor de marca que no se derive se detecte.
 * - Cambia nombre, metadata y tipografía.
 * - Reutiliza los assets de Emphasys: las rutas existen y el build no necesita
 *   archivos nuevos.
 */
export const acmeBrand: BrandDefinition = {
  ...emphasysBrand,
  id: 'acme',
  name: 'Acme',
  colors: {
    blue: { base: '#0b4f6c', hover: '#093f57', tint: '#e3f1f7', wash: '#d9ecf4' },
    graphite: {
      chrome: '#22303a',
      raised: '#33424d',
      deep: '#1e2a33',
      selection: '#56707f',
      itemForeground: '#f0ead9',
      accent: '#cfd8c0',
    },
    beige: { base: '#f2efe6', hover: '#ebe6d8', border: '#ddd6c5', tint: '#e9e1cd' },
    ivory: { surface: '#f6f4ec', elevated: '#fffbf1', well: '#fffdf7', selected: '#faf7ee' },
    ink: { primary: '#2f3a2c', secondary: '#4f5a4b', muted: '#6f786a' },
    accent: '#7a3e9d',
  },
  typography: {
    functional: "Inter, system-ui, sans-serif",
    navigation: 'Inter, system-ui, sans-serif',
    editorialFigure: 'Georgia, serif',
  },
  metadata: {
    title: 'Acme ERP',
    appName: 'Acme ERP',
    shortName: 'Acme',
    description: 'ERP de prueba white label',
    themeColor: '#0b4f6c',
    backgroundColor: '#f6f4ec',
  },
};
