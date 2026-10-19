# Auditoría — Degradados, sombras y `rgba` (elevación)

> Rama `feature/white-label` · HEAD `9c50054` · 2026-10-18 · Solo diagnóstico: no se modificó código.
> Parte de PE-107 (sigue abierta). Excluye `dev-mockups`, Compass y legado sin importadores.

## 0. Resumen

- **158 líneas con `boxShadow`**, 5 degradados y 143 `rgba(...)`. De esos `rgba`, 26 son definiciones en `theme/tokens.ts`.
- Solo **52 líneas** tienen sombras de elevación con `rgba` escrito a mano. Son **60 usos** de **23 strings distintos**, y **tres strings concentran el 55%**:
  - el control y la selección del rail de navegación, en negro;
  - las superficies flotantes (menús, FAB, acciones flotantes), en grafito.
- El color base de cada sombra ya tiene dueño:
  - **grafito `#2c3138`** (`brand.colors.graphite.deep`) y **tinta beige `#3e3428`** (`brand.colors.ink.primary`): son de la marca;
  - **slate-900 `#0f172a`**, **tinta `#0f1626`** (`neutralColors.steel.ink`) y **negro**: son estructurales;
  - **azul `#1d2f68`**: es de la marca.
- `rgbaFromHex` (`theme/brand/derived.ts`) reproduce **byte a byte** todas las sombras de marca con el formato `rgba(44, 49, 56, 0.18)`. Las de negro y tinta usan un formato compacto sin espacios (`rgba(0,0,0,0.35)`, `rgba(15,22,38,0.30)`), así que se guardan como string literal.

## 1. Inventario de sombras (`boxShadow`)

| Tipo | Líneas | Estado |
|---|---|---|
| Sin sombra (`'none'`, `0`) | 50 | No requiere token |
| Barra lateral `inset Npx 0 0 <token>` (indicador de selección) | 18 | Ya usa tokens del tema; no es elevación |
| Anillo o foco `0 0 0 Npx <token>` | 11 | Ya usa tokens del tema o `palette`; no es elevación |
| Elevación derivada del tema (`color-mix`, `hoverTint`, `brandBlueAlpha`) | 18 | Ya es dinámica; ver §4.4 |
| **Elevación con `rgba` literal** | **52** | **Objetivo de este bloque** |
| Otros: `boxShadow: 2` (sombras de MUI), helper `lineaCampo` | 8 | Fuera: usan el sistema de MUI o un helper ya tokenizado |

### 1.1 Strings de sombra con `rgba` literal (60 usos, 23 distintos)

| Usos | String exacto | Base | Rol observado | Dónde |
|---|---|---|---|---|
| 12 | `0 1px 2px rgba(0,0,0,0.18)` | negro | Elemento **seleccionado** en el rail de navegación de los workspaces | Workspaces de facturas, cotizaciones, notas, traslados, pagos, ajustes, recepción y OC; listas compactas de contactos y productos; historial de conciliaciones; movimientos de inventario |
| 11 | `0 1px 2px rgba(0,0,0,0.35)` | negro | **Control** sobre el rail (botón "Nuevo …" sobre `navigation.control`) | Mismos workspaces, `ActividadesWorkspaceView`, listas compactas, `InventarioMovimientosPage` |
| 10 | `0 16px 40px rgba(44, 49, 56, 0.18)` | grafito (marca) | **Superficie flotante**: menú contextual, FAB, acciones flotantes, popovers | `WorkspaceRowContextMenu`, `MobileSaveFab`, `FloatingFormActions`, menús de workspaces, vistas móviles |
| 3 | `0 8px 20px rgba(15, 23, 42, 0.05)` | slate-900 | **Tarjeta** de lista móvil | `DocumentosMobileView`, `ContactosMobileView`, `ProductosMobileView` |
| 3 | `0 18px 48px rgba(62, 52, 40, 0.16)` | tinta beige (marca) | **Diálogo** del tema experimental | `TrasladosWorkspaceView`, `CartaPorteIssuesDialog`, `InventarioMovimientoErrorDialog` |
| 2 | `0 10px 28px rgba(62, 52, 40, 0.08)` | tinta beige (marca) | **Panel** elevado (editor de Carta Porte) | `CartaPorteViajeEditor` ×2 |
| 2 + 2 | `0 12px 32px rgba(15,22,38,0.18)` / al arrastrar `0 20px 46px rgba(15,22,38,0.30)` | tinta `#0f1626` | **Resumen flotante arrastrable** (reposo / arrastre) | `FacturaResumenFlotante`, `ResumenFlotanteMarco` |
| 1 | `0 8px 18px rgba(44, 49, 56, 0.22)` | grafito (marca) | Botón flotante móvil secundario | `DocumentosMobileView:276` |
| 1 | `0 8px 24px rgba(62, 52, 40, 0.12)` | tinta beige (marca) | Desplegable de búsqueda | `BuscadorMovimientos:188` |
| 1 | `0 10px 24px rgba(29, 47, 104, 0.28)` | **azul (marca)** | FAB primario móvil (resplandor de marca) | `DocumentosMobileView:284` |
| 1 | `0 6px 16px rgba(29, 47, 104, 0.16)` | **azul (marca)** | Botón de filtros activo | `OportunidadesPage:1614` |
| 1 | `0 14px 34px rgba(15, 23, 42, 0.14)` | slate-900 | Menú contextual de grids | `GridContextMenu:79` |
| 1 + 1 | `0 18px 48px rgba(15, 23, 42, 0.18)` / `0 2px 8px rgba(15, 23, 42, 0.08)` | slate-900 | Drawer de actualización y su botón cerrar | `VersionUpdateDrawer:52, 68` |
| 1 | `0 12px 30px rgba(15, 23, 42, 0.12)` | slate-900 | Resumen flotante de documento | `DocumentosFormPage:8596` |
| 1 | `0 6px 18px rgba(15, 23, 42, 0.08)` | slate-900 | Botón "atrás" flotante móvil | `MobileBackIconButton:26` |
| 1 + 1 | `0 8px 18px rgba(15, 23, 42, 0.08 / 0.06)` combinada con anillo `${item.labelColor}` | slate-900 | Tarjetas de estatus de oportunidades (activa / normal) | `OportunidadesPage:1469, 1479` |
| 1 | `0 1px 2px rgba(15, 23, 42, 0.04)` | slate-900 | Sombra mínima de tarjeta | `DocumentosPage:3883` |
| 1 | `0 1px 2px rgba(0,0,0,0.04)` | negro | Sombra mínima de tarjeta | `OportunidadesPage:2141` |
| 1 | `0 1px 0 rgba(20,28,46,0.03)` | `#141c2e` (sin token) | Línea inferior sutil | `NotasCreditoWorkspaceView:1005` |
| 1 | `inset 0 1px 0 rgba(255,255,255,0.16), …color-mix(… ${chrome.activeSurface} …)` | blanco + tema | Pestaña activa del módulo (brillo interior) | `moduleTabBar.ts:98` |

## 2. Degradados (5)

| Archivo:línea | Degradado | Clase | Propuesta |
|---|---|---|---|
| `VersionUpdateDrawer:74` | `linear-gradient(90deg, #1d2f68 0%, #3b82f6 100%)` | Identidad decorativa (azul de marca → azul 500 de Tailwind) | Derivar el inicio de `brand.colors.blue.base`; el final `#3b82f6` necesita decisión (fijo o rol de marca nuevo `blue.bright`) |
| `OportunidadesPage:1628` | `linear-gradient(180deg, #fbfcff 0%, #f6f8fd 100%)` | Estructural (fondo de encabezado) | Rol estructural `surfaceGradients.header` |
| `SeccionCard:33` | `repeating-linear-gradient(135deg, rgba(107,114,128,0.05) …)` | Patrón de sección deshabilitada (rayado gray-500) | Rol estructural `patterns.disabledHatch` |
| `ProductoWorkspace:747` | `linear-gradient(${grid.hover}, ${grid.hover})` | Técnica para superponer un tinte; ya usa tokens | Sin cambio |
| `InventarioMovimientoFormPage:1275` | `linear-gradient(${grid.stripe}, ${grid.stripe})` | Ídem | Sin cambio |

## 3. `rgba` fuera de sombras (no es elevación)

Son 83 usos: 26 en `theme/tokens.ts`, que son definiciones de roles y quedan fuera, y **57 en componentes**. Son **tintes y velos**, no elevación:

| Base | Usos | Ejemplos |
|---|---|---|
| Blanco con alfa (velos sobre cromado oscuro) | ~28 | `rgba(255,255,255,0.08/0.14/0.16/0.6/0.7)` en `VersionUpdateDrawer`, `DocumentosDesktopView`, leads, `RuntimeEnvironmentIndicator` |
| Azul de marca con alfa (hover y selección) | 17 | `rgba(29,47,104,0.06/0.08/0.10/0.16/0.24)` |
| Slate, negro, beige, rojo, verde, gray-500 con alfa | ~12 | Bordes y fondos suaves |

Propuesta: un **bloque posterior de tintes alfa**, con `brandBlueAlpha` (ya existe) y un helper `whiteAlpha`. No se mezcla con elevación.

## 4. Propuesta de tokens de elevación (pendiente de confirmación)

Nuevo `theme/elevation.ts`. **Cada token produce exactamente el string actual.** Los de marca se derivan con `rgbaFromHex`, y la prueba exige igualdad byte a byte para Emphasys.

### 4.1 Estructurales (valor fijo, string literal)

```ts
export const elevation = {
  /** Control sobre el rail de navegación (botón "Nuevo …"). */
  railControl: '0 1px 2px rgba(0,0,0,0.35)',
  /** Elemento seleccionado en el rail de navegación. */
  railSelection: '0 1px 2px rgba(0,0,0,0.18)',
  /** Sombra mínima de tarjeta (dos variantes de base que hoy conviven). */
  hairline: '0 1px 2px rgba(15, 23, 42, 0.04)',
  hairlineBlack: '0 1px 2px rgba(0,0,0,0.04)',
  /** Tarjeta de lista móvil. */
  card: '0 8px 20px rgba(15, 23, 42, 0.05)',
  /** Botón flotante móvil secundario (atrás). */
  floatingButton: '0 6px 18px rgba(15, 23, 42, 0.08)',
  /** Menú contextual de grids. */
  gridMenu: '0 14px 34px rgba(15, 23, 42, 0.14)',
  /** Resumen flotante de documento (cristal). */
  floatingSummary: '0 12px 30px rgba(15, 23, 42, 0.12)',
  /** Resumen flotante arrastrable: reposo y arrastre. */
  draggable: '0 12px 32px rgba(15,22,38,0.18)',
  dragging: '0 20px 46px rgba(15,22,38,0.30)',
  /** Drawer de actualización y su botón. */
  drawer: '0 18px 48px rgba(15, 23, 42, 0.18)',
  drawerButton: '0 2px 8px rgba(15, 23, 42, 0.08)',
  /** Línea inferior sutil. */
  underline: '0 1px 0 rgba(20,28,46,0.03)',
};
```

### 4.2 Derivados de la marca (siguen a una marca futura)

```ts
export const brandElevation = {
  /** Superficie flotante: menús, FAB, acciones flotantes (grafito). */
  floating: `0 16px 40px ${rgbaFromHex(graphite.deep, 0.18)}`,
  floatingStrong: `0 8px 18px ${rgbaFromHex(graphite.deep, 0.22)}`,
  /** Diálogo, panel y desplegable del tema experimental (tinta beige). */
  dialog: `0 18px 48px ${rgbaFromHex(ink.primary, 0.16)}`,
  panel: `0 10px 28px ${rgbaFromHex(ink.primary, 0.08)}`,
  dropdown: `0 8px 24px ${rgbaFromHex(ink.primary, 0.12)}`,
  /** Resplandor de marca: FAB primario y filtros activos (azul). */
  primaryGlow: `0 10px 24px ${rgbaFromHex(blue.base, 0.28)}`,
  activeGlow: `0 6px 16px ${rgbaFromHex(blue.base, 0.16)}`,
};
```

Comprobado: `rgbaFromHex('#2c3138', 0.18)` = `rgba(44, 49, 56, 0.18)`, y `rgbaFromHex('#3e3428', 0.16)` = `rgba(62, 52, 40, 0.16)`. Los 7 valores producen el string actual.

### 4.3 Compuestas y degradados

- **Oportunidades 1469 y 1479**: el anillo usa `${item.labelColor}` (estado), seguido de `elevation.statusCard` (`0 8px 18px rgba(15, 23, 42, 0.08)`) o de `statusCardRest` (`… 0.06`). Se migra solo la parte `rgba`.
- **Degradados**: `brandGradients.updateBar`, cuyo inicio deriva del azul de marca y cuyo final depende de la decisión D-E2; `surfaceGradients.header`; `patterns.disabledHatch`.

### 4.4 Lo que no se propone

- No unificar sombras parecidas. Por ejemplo, `hairline` y `hairlineBlack`, o `card` y `floatingButton`, conviven con valores distintos.
- No tocar las sombras de MUI (`boxShadow: 2`, `elevation={n}`) ni las sombras ya dinámicas (`color-mix` con `action.primary` o `frame.background`, `hoverTint`, `brandBlueAlpha`).
- No mezclar con los tintes alfa (§3).

## 5. Plan por bloques (tras confirmación)

| # | Bloque | Usos | Riesgo |
|---|---|---|---|
| E1 | `elevation.railControl` y `railSelection` en workspaces y listas compactas | 23 | Bajo: string literal idéntico; muchos archivos (~15) |
| E2 | `brandElevation`: flotantes, diálogos, panel, desplegable y botón flotante grafito | 17 | Medio: introduce derivación de marca (ver D-E1) |
| E3 | `elevation` estructurales restantes (tarjetas, menús, resúmenes, drawer, línea, compuestas de Oportunidades) | 16 | Bajo |
| E4 | Resplandores azules y degradados | 2 + 3 | Medio: necesita las decisiones D-E2 y D-E3 |

## 6. Riesgos

1. **Formato exacto:** `rgba(0,0,0,0.35)` y `rgba(0, 0, 0, 0.35)` son el mismo color, pero romperían la equivalencia byte a byte. Por eso los estructurales se guardan como string literal y los de marca solo se derivan cuando `rgbaFromHex` reproduce el mismo formato. Las alfas con cero final, como `0.30`, no se derivan.
2. **Derivar de la marca cambia el comportamiento futuro, no el actual:** con otra marca, las sombras flotantes y de diálogo tomarían su grafito y su tinta. Es deseable para white label, pero es una decisión (D-E1).
3. **Sombras parecidas con valores distintos:** se mantienen separadas; unificarlas cambiaría la apariencia.
4. **Archivos compartidos con bloques previos** (workspaces, `DocumentosMobileView`, `OportunidadesPage`, `DocumentosFormPage`…): los fixtures nuevos van al final de `LATER_FIXTURES`, y las pruebas anteriores revierten primero los bloques posteriores.
5. **Conflictos con `main`:** en las referencias locales no hay commits nuevos desde el merge-base del 2026-10-15.

## 7. Pruebas necesarias

1. **Igualdad de strings:** cada token de `elevation` es idéntico al literal que reemplaza; cada token de `brandElevation` es idéntico para `emphasysBrand`.
2. **Seguimiento de marca:** con una marca de prueba (otro grafito, otra tinta u otro azul), `brandElevation` cambia y `elevation` no.
3. **Equivalencia contra HEAD** por bloque (fixture por línea, SHA-256), **transformación** (reemplazos declarados) y **mutación** (alterar un token o un color de marca rompe las pruebas).
4. **Cierre:** al terminar E1 a E4, en los archivos migrados solo quedan las sombras ya dinámicas o de MUI. Una prueba lo fija.
5. **Paridad global:** fixtures de tokens y temas MUI byte-idénticos; `tsc` (213 preexistentes), build y `git diff --check`.

## 8. Decisiones que necesito

- **D-E1.** ¿Las sombras flotantes, de diálogo, panel y desplegable deben **derivarse de la marca** (grafito y tinta) como propone §4.2, o quedar fijas como estructurales?
- **D-E2.** Degradado de `VersionUpdateDrawer`: ¿el final `#3b82f6` se queda fijo, o se agrega un rol de marca `blue.bright`?
- **D-E3.** Resplandores azules (`primaryGlow`, `activeGlow`): ¿se derivan del azul de marca, como las sombras de §4.2?
- ¿Apruebas la estructura `theme/elevation.ts` (`elevation` + `brandElevation`) y el plan E1 a E4?

## 9. Decisiones y estado

- **D-E1 y D-E3, aprobadas:** las sombras de grafito, tinta beige y azul se derivan de la marca (`brandElevation`). Las estructurales (negro, slate-900, `#0f1626`, `#141c2e`) quedan fijas (`elevation`). No se unifica nada por similitud.
- **D-E2:** pendiente. Los degradados quedan fuera por ahora.
- `theme/elevation.ts` define 15 tokens estructurales y 7 de marca (`buildBrandElevation(brand)`). Cada uno reproduce un literal que existía en HEAD `9c50054`, como fija `__fixtures__/elevation.baseline.json`.
- **E1, completado:** 23 reemplazos en 13 archivos. `0 1px 2px rgba(0,0,0,0.35)` pasa a `elevation.railControl` y `…0.18` a `elevation.railSelection`.
- **E2, completado:** 17 reemplazos en 16 archivos. Pasan a `brandElevation.floating` (×10), `floatingStrong` (×1), `dialog` (×3), `panel` (×2) y `dropdown` (×1). Con Emphasys producen el mismo string; con otro grafito o tinta beige, cambian solo esas sombras.
- Pendientes: E3 (estructurales restantes) y E4 (resplandores azules y degradados).
