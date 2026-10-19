# Auditoría — Blancos (`#fff`, `#ffffff`, `'white'`)

> Rama `feature/white-label` · HEAD `de9962a` · 2026-10-18 · Solo diagnóstico: no se modificó código.
> Parte de PE-107 (sigue abierta). Excluye `dev-mockups`, Compass, `theme/` y el legado (`Layout`, `Menu`, `Sidebar`, `SecondaryNav`).

## 0. Resumen

- **103 usos de blanco en 35 archivos:**
  - `'#fff'` ×48;
  - `'#ffffff'` ×34;
  - `'white'` ×7;
  - `common.white` ×14.
- **Fuera de alcance: los 14 `common.white`**, que ya leen la `palette` de MUI. Están en informes contables, Kardex, `FacturaPagosDrawer` y otros.
- **Dentro de alcance: 89 literales en 29 archivos.** Por rol:

| Rol | Literales | Capa propuesta |
|---|---|---|
| A. Superficie blanca (tarjeta, panel, control, campo) | 44 | Estructural |
| B. Fondo de fila (alterna o no seleccionada) | 6 | Estructural |
| C. Texto o icono sobre azul de marca o `primary.main` | 14 | Estructural fija o marca (**D-B1**) |
| D. Texto o icono sobre encabezado oscuro de grid | 7 | Estructural |
| E. Texto sobre color funcional, de tercero o dato de usuario | 15 | Funcional |
| F. Icono sobre imagen u overlay | 3 | Estructural (`overlayColors.media`) |

- **Formato:** cada rol se queda con la escritura que usa hoy. Donde un mismo rol mezcla `'#fff'` y `'#ffffff'`, o `'white'`, se proponen tokens separados, con el mismo criterio que en elevación y tintes.
- **Inconsistencias del tema** (se documentan y no se tocan):
  - `configPrimaryButtonSx` pinta `#fff` sobre `theme.emphasys.action.primary`, pero en el tema experimental `action.primaryForeground` es beige;
  - en `OportunidadesPage`, el encabezado del grid fuerza `#ffffff` aunque el tema experimental defina `grid.headerForeground` en beige.
  - Usar el rol del tema en cualquiera de los dos casos cambiaría la apariencia (**D-B4**).

## 1. Inventario por rol

### A. Superficie blanca (44)

| Subrol | Formato | Usos |
|---|---|---|
| Panel o tarjeta de escritorio | `'#fff'` | `EmpresaSelector:55`, `ResumenSatCards:36`, `CotizacionPartidasTab:132, 216`, `NotaCreditoCaptura:589, 670, 1024, 1112, 1124`, `AplicarSaldoNotaCreditoDialog:175, 629`, `OperacionDetalleDrawer:551`, `DocumentosDesktopView:215` (rama clásica de `catalog ? content.card : …`), `OportunidadesPage:2142`, `DocumentosFormPage:4727` (15) |
| Panel de totales del formulario | `'#ffffff'` | `DocumentosFormPage:7341, 7767` (2) |
| Resumen flotante | `'#fff'` | `FacturaResumenFlotante:196, 221, 266`, `ResumenFlotanteMarco:167, 194, 242` (rama no tematizada) (6) |
| Estado vacío de lista móvil | `'#fff'` | `ContactosMobileView:151`, `DocumentosMobileView:145`, `ProductosMobileView:107` (3) |
| Tarjeta de lista móvil | `'#ffffff'` | `ContactosMobileView:173`, `DocumentosMobileView:179`, `ProductosMobileView:127` (3) |
| Lista móvil de contactos | `'#fff'` | `ContactosMobileView:225` (1) |
| Drawer de seguimiento de actividad (encabezado, tarjetas, campo) | `'#ffffff'` | `ActividadSeguimientoDrawer:547, 602, 631, 637, 650, 680, 753, 761` (8) |
| Control no seleccionado (toggle, chip) | `'#fff'` | `DocumentosFormPage:3937`, `DocumentosPage:3569`, `TemperaturaScoreButton:91` (chip desactualizado) (3) |
| Botón delineado o flotante | `'#ffffff'` | `DocumentosMobileView:127`, `MobileBackIconButton:24` (2) |
| Miniatura de imagen | `'#ffffff'` | `SeccionImagenesArchivos:141` (1) |

### B. Fondo de fila (6)

| Subrol | Formato | Usos |
|---|---|---|
| Fila alterna o no seleccionada | `'#fff'` | `NotaCreditoCaptura:180`, `AplicarSaldoNotaCreditoDialog:501, 571`, `DocumentosFormPage:4890` (4) |
| Fila alterna de documentos de tesorería (par de `rowStripeColors.treasuryDocuments`) | `'#ffffff'` | `OperacionDetalleDrawer:421, 519` (2). `FacturaPagosDrawer` usa `common.white` en el mismo rol y queda fuera |

### C. Sobre azul de marca o `primary.main` (14)

| Formato | Usos |
|---|---|
| `'#ffffff'` | `DocumentosDesktopView:131` (botón sobre `activeBrand.colors.blue.base`), `DocumentosMobileView:284` (FAB sobre azul) (2) |
| `'#fff'` | `FacturaResumenFlotante:297` (total sobre encabezado azul), `:343` ×2 (botón azul y su hover), `NotaCreditoCaptura:575` (chip sobre `primary.main`), `DocumentosFormPage:3936, 4294, 4655, 5235, 5576` (toggle, total y botones sobre `primary.main`), `configVisual:143` (botón sobre `action.primary`) (10) |
| `'white'` | `ConciliacionBancariaPage:791, 878` (spinner dentro del botón primario) (2) |

### D. Sobre encabezado oscuro de grid (7)

`OportunidadesPage:1891, 1895, 1899, 1902, 1905, 1908, 1911`: `'#ffffff'`. Son el texto y los iconos del encabezado, el ícono de ordenar, el menú y el separador.

### E. Sobre color funcional, de tercero o dato (15)

| Fondo | Formato | Usos |
|---|---|---|
| Entorno producción (`environmentColors.productionBackground`) | `'#fff'` | `RuntimeEnvironmentIndicator:56` (1) |
| Verde de WhatsApp (`thirdPartyColors.whatsapp`) | `'white'` | `LeadsDesktopView:1491`, `LeadsMobileView:2097`, `LeadsPage:2969` (3) |
| Chip de filtro activo (`leadFilterChipColors.activeBackground`) | `'#ffffff'` | `LeadsMobileView:1981, 2011` (2) |
| Chip "Finalizadas" activo (fondo `text.secondary`) | `'#ffffff'` | `LeadsDesktopView:1413`, `LeadsMobileView:2022` (2) |
| Color de temperatura (`temperaturaColor`) | `'#fff'` | `TemperaturaProspectoModal:115`, `TemperaturaScoreButton:92` (2) |
| Color de etiqueta guardado en BD (`tag.color`) | `'#fff'` | `LeadDetailPanel:212, 215` (2) |
| Contraste calculado contra el color de etapa de BD (blanco o `gray[900]`) | `'#ffffff'` | `ProduccionDetalleDrawer:85`, `DocumentosPage:249`, `ProduccionPage:90` (3) |

### F. Sobre imagen u overlay (3)

`LeadsDesktopView:1860` (icono de video) y `:1861` (botón sobre adjunto) usan `'white'`. `ProduccionDetalleDrawer:165` (icono sobre la insignia `overlayColors.media.imageBadge`) usa `'#fff'`.

## 2. Qué no se propone

- No unificar `'#fff'`, `'#ffffff'` ni `'white'`. Tampoco reemplazarlos por `common.white` ni por `palette`: cambiaría el string, y en el tema experimental también el valor.
- No leer `action.primaryForeground` ni `grid.headerForeground` donde hoy hay blanco fijo (D-B4).
- No tocar `common.white` ni el legado.

## 3. Propuesta de tokens (pendiente de confirmación)

### 3.1 Estructurales (`structural.ts`, nueva familia `whiteSurfaces`, más grupos en `overlayColors`)

```ts
export const whiteSurfaces = {
  panel: '#fff',                 // A, 15
  totalsPanel: '#ffffff',        // A, 2 (DocumentosFormPage)
  floatingSummary: '#fff',       // A, 6
  mobileEmptyState: '#fff',      // A, 3
  mobileListCard: '#ffffff',     // A, 3
  mobileList: '#fff',            // A, 1 (lista de contactos)
  activityDrawer: '#ffffff',     // A, 8
  controlIdle: '#fff',           // A, 3
  outlineButton: '#ffffff',      // A, 1
  floatingButton: '#ffffff',     // A, 1
  imageThumb: '#ffffff',         // A, 1
  tableRow: '#fff',              // B, 4
  treasuryRowAlt: '#ffffff',     // B, 2
} as const;
// overlayColors (ya existe):
onDark.gridHeaderForeground: '#ffffff'  // D, 7
media.iconForeground: 'white'           // F, 2
media.badgeIcon: '#fff'                 // F, 1
```

### 3.2 Funcionales (`functional.ts`)

| Token | Valor | Usos |
|---|---|---|
| `environmentColors.productionText` | `'#fff'` | 1 |
| `thirdPartyColors.whatsappForeground` | `'white'` | 3 |
| `leadFilterChipColors.activeForeground` | `'#ffffff'` | 2 |
| `leadViewToggleColors.activeForeground` | `'#ffffff'` | 2 |
| `temperatureColors.foreground` | `'#fff'` | 2 |
| `userColorChipForeground` | `'#fff'` (texto sobre color de etiqueta de BD; el color de fondo sigue siendo dato) | 2 |
| `contrastColors.light` | `'#ffffff'` (par de `neutralColors.gray[900]` en el cálculo de contraste) | 3 |

### 3.3 Sobre azul de marca o primario (14): D-B1

- **Opción A (recomendada): estructural fija.** `onPrimary.text` `'#fff'` (10), `onPrimary.textLong` `'#ffffff'` (2) y `onPrimary.progress` `'white'` (2). Es lo más seguro: una marca futura con azul claro necesitaría revisar el contraste, y eso se documentaría.
- **Opción B: rol de marca.** `BrandDefinition.colors.blue.foreground` con formatos explícitos. Sigue a la marca, pero cambia `BrandDefinition` y su fixture de paridad.

## 4. Plan por bloques (tras confirmación)

| # | Bloque | Literales | Notas |
|---|---|---|---|
| W1 | Funcionales y overlays (E + F) | 18 | Tokens en familias ya existentes |
| W2 | Sobre primario y encabezado oscuro (C + D), fuera de `DocumentosFormPage` | 16 | Depende de D-B1 |
| W3 | Superficies y filas fuera de `DocumentosFormPage` (A + B) | 45 | `whiteSurfaces` |
| W4 | `DocumentosFormPage` completo y su cierre | 10 | Superficies `3937`, `4727`, `7341` y `7767`; fila `4890`; sobre primario `3936`, `4294`, `4655`, `5235` y `5576`. El cierre de la página baja de 10 literales a 0 |

Total: 18 + 16 + 45 + 10 = 89. Los 10 blancos de `DocumentosFormPage` van juntos en W4, para que un solo commit cierre la página.

En cada bloque:
- fixture por línea;
- equivalencia SHA-256 contra HEAD;
- transformación;
- mutación, incluida la de formato (`'#fff'` ↔ `'#ffffff'` ↔ `'white'`);
- cierre;
- `tsc`, build y `git diff --check`.

Al final, una prueba de cierre global: fuera de `theme/` y del legado no queda ningún blanco literal; solo `common.white`.

## 5. Riesgos

1. **Tres formatos.** Una sustitución mecánica rompería la equivalencia byte a byte, y por eso cada token conserva su escritura.
2. **Ramas tematizadas** (`catalog ? theme.content.card : '#fff'`, `apariencia === 'tema' ? … : '#fff'`): solo se migra la rama literal y la del tema sigue igual.
3. **Pruebas previas que fijan blancos:** el cierre de `DocumentosFormPage` (10), el cierre global de R1 (cuenta `#ffffff` como "bloque siguiente") y los bloques de tintes (líneas compartidas en `LeadsMobileView` y `OperacionDetalleDrawer`). Se ajustan con `revertLater`, como en E3, T4 y R1.
4. **Contraste en una marca futura** (D-B1): con la opción A, un azul claro dejaría texto blanco ilegible. Se documenta como requisito de la marca.

## 6. Decisiones que necesito

- **D-B1.** Blancos sobre azul o primario: ¿estructural fija (A) o rol de marca (B)?
- **D-B2.** ¿Apruebas la granularidad por subrol de `whiteSurfaces` (12 roles), o prefieres menos roles, sin unificar formatos?
- **D-B3.** El texto sobre el color de etiqueta de BD y el contraste calculado contra el color de etapa: ¿tokens funcionales, como propone §3.2, o exclusión documentada como "derivado de dato"?
- **D-B4.** Las dos inconsistencias del tema (`configPrimaryButtonSx` y el encabezado de Oportunidades): ¿se quedan como pendientes de diseño, junto a D1–D9?

## 7. Decisiones y estado

- **D-B1, opción A:** los blancos de contraste sobre azul de marca o primario son estructurales y fijos (`onPrimaryColors` en `structural.ts`). No siguen a la marca y no se unifican sus formatos.
- **Numeración:** por indicación posterior, W1 es el bloque de contraste sobre azul o primario (rol C de §1). Los demás bloques de §4 se renumeran cuando se confirmen.

### 7.1 W1 — contraste sobre azul o primario (completado)

Se verificó el fondo de cada caso. Quedan **12 literales en 7 archivos**: `'#fff'` ×9, `'#ffffff'` ×2 y `'white'` ×1.

| Archivo:línea (HEAD `de9962a`) | Fondo | Literal | Token |
|---|---|---|---|
| `DocumentosDesktopView:131` | `activeBrand.colors.blue.base` | `'#ffffff'` | `onPrimaryColors.textLong` |
| `DocumentosMobileView:284` | `activeBrand.colors.blue.base` (FAB) | `'#ffffff'` | `onPrimaryColors.textLong` |
| `FacturaResumenFlotante:297` | encabezado `activeBrand.colors.blue.base` | `'#fff'` | `onPrimaryColors.text` |
| `FacturaResumenFlotante:343` | botón `activeBrand.colors.blue.base` | `'#fff'` (solo el estado normal) | `onPrimaryColors.text` |
| `NotaCreditoCaptura:575` | chip `'primary.main'` | `'#fff'` | `onPrimaryColors.text` |
| `configVisual:143` | `theme.emphasys.action.primary` | `'#fff'` | `onPrimaryColors.text` (D-B4: en el tema experimental el tema define beige; se conserva el blanco) |
| `ConciliacionBancariaPage:791` | botón `contained` primario | `'white'` | `onPrimaryColors.progress` |
| `DocumentosFormPage:3936, 4294, 4655, 5235, 5576` | `'primary.main'` | `'#fff'` | `onPrimaryColors.text` |

**Excluidos tras la verificación**, siguen literales y una prueba los fija:
- `FacturaResumenFlotante:343`, `'&.Mui-disabled'`: `color: '#fff'` sobre `steel.controlBorder` (gris). Es estado deshabilitado, no contraste sobre primario;
- `ConciliacionBancariaPage:878`: spinner `'white'` dentro de un botón `color="warning"`, que es funcional.

Cambios en pruebas:
- El cierre de `DocumentosFormPage` baja a 5 blancos (`#fff` ×3, `#ffffff` ×2), todos de superficie y fila.
- `whitesColors.test.ts` (7) cubre:
  - alcance por formato;
  - paridad de formatos e independencia de la marca;
  - equivalencia SHA-256 contra HEAD (7/7);
  - transformación;
  - verificación de que el fondo de cada reemplazo es azul o primario;
  - mutación de formato (`'#fff'` ↔ `'#ffffff'` ↔ `'white'`);
  - exclusiones.
