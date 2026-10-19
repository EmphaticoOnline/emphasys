# Auditoría — Restos R1 (hex no blancos sin migrar)

> Rama `feature/white-label` · HEAD inicial `e410ad5` · 2026-10-18. Parte de PE-107 (sigue abierta).
> Excluye `dev-mockups`, Compass, `theme/` y el legado sin importadores (`Layout`, `Menu`, `Sidebar`, `SecondaryNav`).

## 0. Inventario

Al revisar el estado para el estimado aparecieron **113 hex de 6 dígitos** fuera de `theme/`. Ninguna prueba de cierre global los cubría:

| Clase | Literales | Archivos | Destino |
|---|---|---|---|
| Blancos `#ffffff` | 34 | 15 | Bloque de blancos (después de R1) |
| Datos de usuario o BD (valores por defecto guardados) | 25 | 7 | **Exclusión documentada** |
| Fallback de BD (`etapa_color \|\| '#e5e7eb'`) | 5 | 3 | **Exclusión documentada** |
| KPI y serie de gráfica (`#1d2f68` en historial de precios y movimientos por período) | 3 | 3 | **Exclusión documentada** (bloques 1 y 7) |
| **R1: sin migrar** | **46** | **19** | Este bloque |

Exclusiones de datos de usuario o BD, sin cambios:
- `LeadsPage` y `WhatsappEtiquetasPage` (`#25D366` inicial de etiqueta);
- `ConfiguracionEtapasProduccionPage` (color de etapa);
- `FormatosImpresionPage` (defaults de formato);
- `ConceptosPage` (color de concepto);
- `DynamicFieldControl` (`COLOR_POR_DEFECTO`);
- `leadsDerivation` (fallback de avatar).

## 1. Clasificación de R1 (46)

| Subbloque | Clase | Literales | Archivos |
|---|---|---|---|
| R1.1 | Funcional y CRM | 30 | 11 |
| R1.2 | Superficies (estructural) y categóricos | 16 | 10 |
| R1.3 | `DocumentosFormPage` | 0 | No aplica: solo le quedan blancos |
| R1.4 | Restos adicionales | 0 | Sin otros casos con clasificación clara |

Ningún literal de R1 es identidad de marca. Ninguno es dato de usuario o fallback de BD.

## 2. R1.1 — funcional y CRM (completado)

30 literales en 11 archivos (22 reemplazos; un ternario cuenta como un reemplazo con dos hex).

| Archivo | Literal(es) | Token | Clase y justificación |
|---|---|---|---|
| `ActividadSeguimientoDrawer` ×2, `OportunidadesPage` ×1 | `#0f766e` | `crmAccents.amount` (nuevo) | Funcional (CRM): importe monetario. **No** reutiliza `documentSummaryTones.tax` aunque el hex coincida |
| `LeadsMobileView` (dos grupos de chips) | `#0f766e` texto, `#0f766e` / `#f0fdfa` fondo, `#99f6e4` borde | `leadFilterChipColors.foreground`, `.activeBackground`, `.surface`, `.border` (nuevos) | Funcional (CRM): chip de filtro. Texto y fondo activo comparten valor pero son dos roles. El `#ffffff` de la misma línea queda para el bloque de blancos |
| `LeadsDesktopView` | `#facc15` / `#fef08a` | `searchHighlightColors.current` / `.match` (nuevos) | Funcional: resaltado de búsqueda. **No** reutiliza `status.draft`, que también es `#facc15` |
| `ActividadesWorkspaceView` | `#e7b2ab`, `#b7d4c4`, `#c9c0dc` | `activityRailTones.overdue` / `.today` / `.upcoming` (nuevos) | Funcional (CRM): estado de la actividad sobre el rail. Distintos de `activityAccents` |
| `OportunidadesPage` | `#7f1d1d` | `alertColors.error[900]` (tono nuevo de la escala) | Funcional: detalle del error bajo el mensaje en `error[700]`. Es red-900 de Tailwind, la misma familia y significado |
| `AutorizacionesReglasPage` | `#ede9fe` / `#6d28d9` | `authorizationModeColors.flowBackground` / `.flowText` (nuevos) | Funcional: chip del modo "Flujo" (los otros modos ya usan `alertColors.info` y `palette`) |
| `InventarioMovimientosPage` | `#4ade80` / `#f87171` | `inventoryAffectationColors.applied` / `.reverted` (nuevos) | Funcional: punto de afectación del movimiento |
| `VencimientosClientesPage`, `VencimientosProveedoresPage` | `#fff5f5` | `alertRowColors.overdue` (nuevo) | Funcional: fila vencida |
| `ProductosBajoMinimoPage` | `#fff5f5` | `alertRowColors.belowMinimum` (nuevo) | Funcional: producto bajo mínimo. Mismo valor que `overdue`, otro rol |
| `FacturaResumenFlotante` | `#e8f4ee`/`#fdf3e3`, `#1c6b47`/`#9a5b00`, `#c9e3d5`/`#ecd9b4` | `fiscalStatusColors.*` (se agregan `completeBorder` e `incompleteBorder`) | Funcional: es **el mismo chip** de datos fiscales completos o incompletos que `DocumentosFormPage`, con la misma variable `fiscalCompleto`. Se reutiliza por significado, no por hex |

Ajustes en pruebas previas, sin relajar lo que verifican:
- `alertColors.test.ts` lee cada archivo tal como lo dejó su bloque (con `revertLater`, como las demás).
- El conjunto de tonos que cubre ese bloque excluye `error[900]`, agregado en R1.1.

Pruebas (`restosColors.test.ts`, 7):
- alcance (literales y archivos por subbloque);
- equivalencia SHA-256 contra HEAD `e410ad5` (11/11);
- transformación (cada token resuelve a su literal);
- mutación de cada token usado;
- valores repetidos declarados como roles distintos;
- independencia de la marca;
- cierre por archivo.

## 3. R1.2 — superficies y categóricos (pendiente)

| Archivo | Literal | Propuesta | Clase |
|---|---|---|---|
| `CartaPorteViajeEditor` ×5 | `#e4eef6`, `#e5f0e8`, `#f8efe4`, `#f3ecf6`, `#e8f2f0` | `categoricalPalettes.cartaPorteSections` | Categórico: un color por sección |
| `FacturaPagosDrawer`, `OperacionDetalleDrawer` ×2 | `#f4faf4` | `rowStripeColors.treasuryDocuments` | Estructural: franja de filas en tablas de documentos de tesorería (mismo rol) |
| `KardexProductoPage` | `#f8f8ff` | `rowStripeColors.kardex` | Estructural: franja de filas del Kardex |
| `DocumentosMobileView:88` | `#eef1f4` | `neutralColors.steel.wash` (existente) | Estructural: barra fija `top: 72` de la página. Es el mismo rol que la barra fija de `DocumentosFormPage`, que ya usa `steel.wash` |
| `DocumentosMobileView:125` | `#c7d2e5` | `neutralColors.steel.outlineButtonBorder` | Estructural: borde de botón delineado |
| `DocumentosPage:3569` | `#e8eefc` | `selectionColors.chipSurface` | Estructural: fondo de chip seleccionado |
| `DocumentosPage:3626` | `#dbe3f4` | `neutralColors.steel.documentFiltersBorder` | Estructural: borde del panel de filtros de documentos |
| `OportunidadesPage:1626` | `#dbe2f0` | `neutralColors.steel.opportunityFiltersBorder` | Estructural: borde del panel de filtros de oportunidades. Mismo rol que el anterior pero otro valor: no se unifican |
| `ComprobantesSatSection:449` | `#e5e9f2` | `neutralColors.steel.tabsDivider` | Estructural: divisor bajo pestañas |
| `EstadoCuentaPage:287` | `#c0c9d6` | `neutralColors.steel.treeConnector` | Estructural: conector `↳` de fila hija |
