/**
 * Capa de marca. Es lo único que cambia entre un cliente white label y otro.
 *
 * Solo contiene identidad: colores de marca, tipografías, assets y metadata.
 * Los colores funcionales (éxito, advertencia, error, info, estados, métricas,
 * WhatsApp, gráficos) y los que vienen de la base de datos no viven aquí.
 */
export type BrandDefinition = {
  id: string;
  name: string;
  colors: {
    /** Azul institucional: acción primaria del tema clásico. */
    blue: {
      base: string;
      hover: string;
      tint: string;
      wash: string;
      /** Texto sobre `base`; solo lo definen las marcas de empresa (Emphasys usa blanco). */
      foreground?: string;
    };
    /** Grafitos del cromado (sidebar, topbar, encabezados de grid). */
    graphite: {
      chrome: string;
      raised: string;
      raisedForeground: string;
      deep: string;
      selection: string;
      /** Texto e iconos de las opciones del menú principal. */
      itemForeground: string;
      accent: string;
      /** Texto sobre `chrome`; solo lo definen las marcas de empresa con Sidebar propio. */
      chromeForeground?: string;
    };
    /** Beige del tema experimental: página, hover, bordes. */
    beige: {
      base: string;
      hover: string;
      border: string;
      tint: string;
    };
    /** Marfil del tema experimental: superficies de contenido. */
    ivory: {
      surface: string;
      elevated: string;
      well: string;
      selected: string;
    };
    /** Tinta cálida del tema experimental: texto sobre beige/marfil. */
    ink: {
      primary: string;
      secondary: string;
      muted: string;
    };
    /** Acento verde petróleo (indicador de navegación de documentos). */
    accent: string;
  };
  typography: {
    functional: string;
    navigation: string;
    editorialFigure: string;
  };
  assets: {
    /** Archivos en `src/assets/`. */
    logo: string;
    logoMark: string;
    /** URLs servidas desde `public/`. */
    favicon: string;
    appleTouchIcon: string;
    manifest: string;
    icons: Record<16 | 32 | 48 | 64 | 128 | 180 | 192 | 256 | 512, string>;
  };
  metadata: {
    title: string;
    appName: string;
    shortName: string;
    description: string;
    themeColor: string;
    backgroundColor: string;
  };
};
