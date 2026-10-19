/**
 * Neutrales estructurales escritos a mano en componentes del tema clásico:
 * bordes, textos secundarios y fondos suaves. Son las escalas gray y slate de
 * Tailwind con su número de tono, más los azul-grises propios de Emphasys, para
 * conservar cada valor exacto.
 *
 * No dependen de la marca: si una marca futura necesita otros neutrales, se
 * derivarán aquí de forma explícita. Tampoco son los roles de `EmphasysTokens`
 * (`content.border`, `content.muted`…), que cambian con el tema experimental.
 */
export const neutralColors = {
  gray: {
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  /** Azul-grises propios de Emphasys (no son de Tailwind), por rol. */
  steel: {
    /** Borde de controles flotantes y tarjetas SAT sobre fondo claro. */
    line: '#dbe3f0',
    /** Borde de tarjetas de CRM. */
    cardBorder: '#dbe3ee',
    /** Borde de paneles flotantes (resumen de factura). */
    panelBorder: '#d9dde6',
    /** Borde de bloques de captura (nota de crédito). */
    inputBorder: '#d7dde7',
    /** Borde de campo de importe inactivo. */
    fieldBorder: '#d5dce6',
    /** Borde del selector de tratamiento fiscal. */
    controlBorder: '#c9d2e8',
    /** Divisores dentro de paneles de captura. */
    divider: '#e5eaf1',
    /** Divisor suave de paneles flotantes. */
    dividerSoft: '#eef0f4',
    /** Divisor entre filas de partidas. */
    rowDivider: '#eef0f3',
    /** Fondo al pasar el cursor en paneles flotantes. */
    hover: '#f0f2f6',
    /** Fondo al pasar el cursor en botones de paneles flotantes. */
    hoverAlt: '#eef1f8',
    /** Franja alterna de tablas de captura. */
    stripe: '#f4f6f8',
    /** Fondo de chips del índice de secciones. */
    chip: '#f1f3f5',
    /** Fondo de bloques de totales de partidas. */
    well: '#f7f8fa',
    /** Fondo de tarjetas de captura repetibles. */
    surface: '#fbfcfe',
    /** Fondo de tarjetas de métricas de CRM. */
    surfaceRaised: '#fcfdff',
    /** Placeholder de campos de importe. */
    placeholder: '#c5cdd8',
    /** Puntos del asa de arrastre. */
    dot: '#a6adbd',
    /** Etiquetas en mayúsculas (eyebrow). */
    label: '#8b93a7',
    /** Texto secundario en paneles flotantes. */
    text: '#5b6479',
    /** Cifras en paneles flotantes. */
    strong: '#3d4557',
    /** Texto más fuerte del formulario de documentos (efecto neto, totales de partida). */
    ink: '#0f1626',
    /** Fondo de la zona de adjuntos (gris MUI 50). */
    attachmentSurface: '#fafafa',
    /** Fondo suave azulado: fila de partida expandida, bloque de impuestos, hover de botón. */
    softSurface: '#f7f9fc',
    /** Lavado azul-gris: hover de fila de partida y barra fija de encabezado. */
    wash: '#eef1f4',
    /** Franja de encabezado y pie de paneles del formulario de documentos. */
    panelBand: '#fafbfd',
    /** Franja alterna de partidas. */
    rowStripe: '#f4f6f9',
    /** Divisores fuertes del panel de partidas. */
    dividerStrong: '#e2e5ec',
    /** Borde del bloque de impuestos. */
    taxBorder: '#e2e6ee',
    /** Divisor dentro del bloque de impuestos. */
    taxDivider: '#dde3ee',
    /** Borde de las tarjetas de totales. */
    totalsBorder: '#96a7c7',
    /** Fondo de las tarjetas del resumen financiero. */
    summarySurface: '#fbfdff',
    // Restos R1.2 (docs/white-label-restos-r1-audit.md).
    /** Borde de botón delineado (filtros en móvil). */
    outlineButtonBorder: '#c7d2e5',
    /** Borde del panel de filtros de documentos. */
    documentFiltersBorder: '#dbe3f4',
    /** Borde del panel de filtros de oportunidades (mismo rol que el anterior, otro valor: no se unifican). */
    opportunityFiltersBorder: '#dbe2f0',
    /** Divisor bajo las pestañas de comprobantes SAT. */
    tabsDivider: '#e5e9f2',
    /** Conector `↳` de fila hija (estado de cuenta). */
    treeConnector: '#c0c9d6',
  },
} as const;

/**
 * Azules claros de selección y resaltado que acompañan al azul de marca
 * (tarjeta seleccionada, fila resaltada, imagen principal). Fijos por ahora;
 * derivarlos de la marca queda pendiente.
 */
export const selectionColors = {
  border: '#9db1ea',
  surface: '#dce6fb',
  rowHover: '#eef5ff',
  highlight: '#f0f4ff',
  principal: '#93c5fd',
  /** Foco y selección de la zona de adjuntos del formulario de documentos (azul 800 de MUI). */
  attachmentFocus: '#1565c0',
  /** Fondo de chip seleccionado (documentos). */
  chipSurface: '#e8eefc',
} as const;

/** Franjas de filas alternas con tinte propio. Fijas y sin marca. */
export const rowStripeColors = {
  /** Tablas de documentos de tesorería (pagos, aplicaciones, facturas pendientes). */
  treasuryDocuments: '#f4faf4',
  /** Kardex de producto. */
  kardex: '#f8f8ff',
} as const;

/**
 * Velos y tintes estructurales: blanco, negro, slate-900 y sky-400 con
 * transparencia. No representan identidad y no cambian con la marca. Ver
 * docs/white-label-tintes-alfa-audit.md (bloque T3).
 *
 * Cada token es el literal exacto que reemplaza, con su formato (con o sin
 * espacios, alfa abreviada `.45`, alfa `1`). Solo comparten token los usos
 * con el mismo valor y el mismo rol; valores iguales con roles distintos son
 * tokens separados (por ejemplo `chat.ownBubbleBorder` y `veils.loading`).
 */
export const overlayColors = {
  /** Sobre superficies oscuras (encabezados de grid, rail, barras, cromado). */
  onDark: {
    /** Separador de columna en encabezado oscuro de grid. */
    gridHeaderSeparator: 'rgba(255,255,255,0.25)',
    /** Hover de ítem seleccionado en el rail. */
    railSelectedHover: 'rgba(255,255,255,0.14)',
    /** Divisor de la barra de selección múltiple. */
    selectionBarDivider: 'rgba(255,255,255,0.2)',
    /** Etiqueta atenuada sobre encabezado azul. */
    mutedLabel: 'rgba(255,255,255,0.7)',
    /** Hover de icono sobre grafito. */
    iconHover: 'rgba(255,255,255,0.12)',
    /** Brillo interior de la pestaña activa del módulo. */
    tabHighlight: 'rgba(255,255,255,0.16)',
  },
  /** Burbujas del chat de leads. */
  chat: {
    ownBubbleBorder: 'rgba(255,255,255,0.6)',
    ownBubbleSurface: 'rgba(255,255,255,0.15)',
    otherBubbleSurface: 'rgba(0,0,0,0.04)',
  },
  /** Controles sobre imágenes. */
  media: {
    /** Botón sobre adjunto de imagen, y su hover (alfa abreviada). */
    imageButton: 'rgba(0,0,0,.45)',
    imageButtonHover: 'rgba(0,0,0,.7)',
    /** Insignia sobre imagen. */
    imageBadge: 'rgba(0,0,0,0.55)',
  },
  veils: {
    /** Velo de carga sobre una tabla. */
    loading: 'rgba(255,255,255,0.6)',
  },
  /** Drawer de actualización de versión. */
  drawer: {
    surface: 'rgba(255, 255, 255, 0.98)',
    closeButton: 'rgba(255,255,255,0.92)',
    closeButtonHover: 'rgba(255,255,255,1)',
    closeButtonBorder: 'rgba(15, 23, 42, 0.08)',
  },
  hover: {
    /** Ítem del menú contextual de grids. */
    gridMenuItem: 'rgba(15, 23, 42, 0.06)',
    /** Fila de grid. */
    gridRow: 'rgba(15, 23, 42, 0.04)',
  },
  text: {
    /** Etiqueta pequeña de campo (coincide con `text.secondary` de MUI; no se lee de `palette`). */
    fieldCaption: 'rgba(0,0,0,0.6)',
  },
  pulse: {
    /** Inicio del pulso de "reciente" (sky-400), fijo (D-T4). */
    recentStart: 'rgba(56, 189, 248, 0.24)',
  },
  /** Panel "Recepciones" del formulario de documentos (bordes slate-400). */
  receptionPanel: {
    border: 'rgba(148,163,184,0.35)',
    headerDivider: 'rgba(148,163,184,0.25)',
    totalBorder: 'rgba(148,163,184,0.4)',
  },
  /** Resumen financiero flotante (cristal) del formulario de documentos. */
  floatingSummary: {
    /** Mismo color que `receptionPanel.border`, escrito con espacios; no se unifican. */
    border: 'rgba(148, 163, 184, 0.35)',
    surface: 'rgba(255, 255, 255, 0.96)',
  },
} as const;
