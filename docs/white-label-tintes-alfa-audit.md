# Auditoría — Tintes alfa (`rgba` fuera de sombras)

> Rama `feature/white-label` · HEAD `2a96ab6` · 2026-10-18 · Solo diagnóstico: no se modificó código.
> Continúa §3 de `docs/white-label-elevacion-audit.md`. Parte de PE-107 (sigue abierta). Excluye `dev-mockups`, Compass, `theme/` y el legado sin importadores.

## 0. Resumen

- **77 coincidencias** de color con alfa fuera de `theme/`. No hay hex de 8 dígitos: el único, `#1d2f6808`, ya se migró en el bloque neutral de informes.
- **22 quedan fuera:**
  - 12 `alpha(...)` que ya leen el tema, la `palette` o un color de BD (`documentoRowAppearance`);
  - 3 que son código, no color (`'rgba('` en `FormatosImpresionPage`, `rgb(${mezclar…})` en `SeleccionEmpresaPage`);
  - 7 del legado (`Layout` 5, `Menu` 2), fuera del alcance white label (§10 de la auditoría inicial).
- **Dentro de alcance: 55 literales `rgba` en 25 archivos.** Por dueño del color base:

| Dueño | Base | Usos | ¿Sigue a la marca? |
|---|---|---|---|
| Marca: azul | `#1d2f68` (29, 47, 104) | 14 | Sí (propuesta) |
| Marca: beige | `#f4f0e8` (244, 240, 232) | 2 | Sí (propuesta) |
| Marca: acento | `#006261` (0, 98, 97) | 1 | Sí (propuesta) |
| Funcional: error | red-600 `#dc2626` | 2 | No |
| Funcional: entorno | blanco (`RuntimeEnvironmentIndicator`) | 2 | No |
| Estructural: blanco | (255, 255, 255) | 19 | No |
| Estructural: negro | (0, 0, 0) | 5 | No |
| Estructural: slate-900 | (15, 23, 42) | 4 | No |
| Estructural: slate-400 | (148, 163, 184) | 4 | No |
| Estructural: sky-400 | (56, 189, 248) | 1 | No |
| Sin dueño | (0, 120, 70) = `#007846` | 1 | Por decidir (D-T3) |

- **Formato:** conviven cinco escrituras que hay que conservar byte a byte:
  - con espacios: `rgba(29, 47, 104, 0.08)`;
  - compacta: `rgba(29,47,104,0.05)`;
  - alfa con cero final: `0.10`, `0.20`;
  - alfa abreviada: `.45`, `.7`;
  - alfa `1`.
  - `rgbaFromHex` hoy solo produce la primera. Ver §3.1.

## 1. Inventario por dueño

### 1.1 Marca: azul `#1d2f68` (14)

| Archivo:línea | Valor exacto | Rol |
|---|---|---|
| `DocumentosDesktopView:308` | `rgba(29, 47, 104, 0.10) !important` | Fila enfocada (documento recién abierto) |
| `DocumentosDesktopView:311` | `rgba(29, 47, 104, 0.16) !important` | Fila enfocada y seleccionada |
| `DocumentosDesktopView:314` | `rgba(29, 47, 104, 0.20) !important` | Fila enfocada, seleccionada, con hover |
| `DocumentosDesktopView:317, 318` | `1px solid rgba(29, 47, 104, 0.24)` | Bordes superior e inferior de la fila enfocada |
| `DocumentosDesktopView:328` | `rgba(29, 47, 104, 0.10)` | Fin del pulso de "reciente" (`@keyframes`) |
| `OportunidadesPage:1934` | `rgba(29, 47, 104, 0.08)` | Fila seleccionada del grid |
| `OportunidadesPage:1937` | `rgba(29, 47, 104, 0.12)` | Fila seleccionada con hover |
| `CotizacionPartidasTab:156` | `rgba(29, 47, 104, 0.06)` | Partida activa |
| `CotizacionPartidasTab:159` | `rgba(29, 47, 104, 0.08)` | Partida activa con hover |
| `VersionUpdateDrawer:51` | `1px solid rgba(29, 47, 104, 0.16)` | Borde del drawer |
| `VersionUpdateDrawer:86` | `rgba(29, 47, 104, 0.08)` | Fondo del icono |
| `AIReportesPage:243` | `rgba(29,47,104,0.05)` (compacto) | Fondo de nota con borde de marca |
| `FacturaResumenFlotante:328` | `1px solid rgba(29,47,104,0.5)` (compacto) | Borde del botón "Volver" (texto en azul de marca) |

Todos acompañan a un elemento que ya usa `activeBrand.colors.blue` (borde, texto o fondo). Con otra marca, hoy quedarían en azul Emphasys junto a un azul distinto.

### 1.2 Marca: beige y acento (3)

| Archivo:línea | Valor exacto | Rol |
|---|---|---|
| `MovimientosTable:1296` | `rgba(244, 240, 232, 0.55)` | Separador de columna sobre encabezado grafito |
| `BuscadorMovimientos:133` | `rgba(244,240,232,0.72)` (compacto) | Icono atenuado sobre grafito |
| `SeccionImagenesArchivos:37` | `rgba(0,98,97,0.1)` (compacto) | Fondo de etiqueta cuyo texto es `activeBrand.colors.accent` |

### 1.3 Funcionales (4)

| Archivo:línea | Valor exacto | Rol | Familia |
|---|---|---|---|
| `NotaCreditoCaptura:256` | `rgba(220, 38, 38, 0.08)` | Hover de botón destructivo (texto `alertColors.error[600/700]`) | `alertColors.error` |
| `AplicarSaldoNotaCreditoDialog:519` | `rgba(220, 38, 38, 0.08)` | Ídem | `alertColors.error` |
| `RuntimeEnvironmentIndicator:57` | `rgba(255,255,255,0.16)` | Fondo del indicador de entorno por defecto | `environmentColors` (bloque 9 los dejó literales) |
| `RuntimeEnvironmentIndicator:58` | `1px solid rgba(255,255,255,0.28)` | Borde del indicador por defecto | `environmentColors` |

### 1.4 Estructurales (33)

**Blanco (17, sin contar los 2 del indicador de entorno):**

| Archivo:línea | Valor | Rol |
|---|---|---|
| `standardDataGridSx:74`, `OportunidadesPage:1913` | `rgba(255,255,255,0.25)` | Separador de columna en encabezado oscuro de grid (mismo rol) |
| `OrdenCompraWorkspaceRail:440`, `RecepcionWorkspaceRail:423` | `rgba(255,255,255,0.14)` | Hover de ítem seleccionado en el rail (mismo rol) |
| `LeadsDesktopView:2012`, `LeadsMobileView:717` | `rgba(255,255,255,0.6)` | Borde de burbuja propia de chat (mismo rol) |
| `LeadsDesktopView:2013`, `LeadsMobileView:718` | `rgba(255,255,255,0.15)` | Fondo de burbuja propia de chat (mismo rol) |
| `PolizasTab:966, 987` | `rgba(255,255,255,0.2)` | Divisor de la barra de selección múltiple |
| `ProgramacionMasivaDrawer:449` | `rgba(255,255,255,0.6)` | Velo de carga (mismo valor que el borde de chat, otro rol) |
| `FacturaResumenFlotante:292` | `rgba(255,255,255,0.7)` | Etiqueta atenuada sobre encabezado azul |
| `BuscadorMovimientos:133` | `rgba(255,255,255,0.12)` | Hover del icono sobre grafito |
| `VersionUpdateDrawer:52` | `rgba(255, 255, 255, 0.98)` | Superficie del drawer |
| `VersionUpdateDrawer:67` | `rgba(255,255,255,0.92)` | Fondo del botón cerrar |
| `VersionUpdateDrawer:70` | `rgba(255,255,255,1)` | Botón cerrar con hover |
| `moduleTabBar:98` | `inset 0 1px 0 rgba(255,255,255,0.16), …color-mix(…)` | Brillo interior de la pestaña activa (sombra compuesta con tema) |

**Negro (5):**

| Archivo:línea | Valor | Rol |
|---|---|---|
| `LeadsDesktopView:1861` | `rgba(0,0,0,.45)` / hover `rgba(0,0,0,.7)` (abreviado) | Botón sobre adjunto de imagen |
| `LeadsMobileView:718` | `rgba(0,0,0,0.04)` | Fondo de burbuja ajena de chat |
| `ProduccionDetalleDrawer:159` | `rgba(0,0,0,0.55)` | Insignia sobre imagen |
| `TratamientoFiscalControl:36` | `rgba(0,0,0,0.6)` | Etiqueta "Tratamiento". Coincide con `text.secondary` de MUI, pero no se reemplaza por `palette` |

**Slate-900 (4):**

| Archivo:línea | Valor | Rol |
|---|---|---|
| `GridContextMenu:91`, `GridContextMenuTrigger:24` | `rgba(15, 23, 42, 0.06)` | Hover del menú contextual de grids (mismo rol) |
| `OportunidadesPage:1931` | `rgba(15, 23, 42, 0.04)` | Hover de fila del grid |
| `VersionUpdateDrawer:68` | `1px solid rgba(15, 23, 42, 0.08)` | Borde del botón cerrar |

**Sky-400 (1):** `DocumentosDesktopView:327` `rgba(56, 189, 248, 0.24)`, inicio del pulso de "reciente".

**`DocumentosFormPage` (6, cerrados como fuera de alcance en la prueba de cierre de la página):**

| Línea | Valor | Rol |
|---|---|---|
| 4291 | `rgba(255,255,255,0.7)` | Etiqueta atenuada sobre `primary.main` (mismo rol que `FacturaResumenFlotante:292`) |
| 8491 | `rgba(148,163,184,0.35)` | Borde del resumen flotante |
| 8500 | `rgba(148,163,184,0.25)` | Divisor del resumen |
| 8561 | `rgba(148,163,184,0.4)` | Borde superior del total |
| 8594 | `rgba(148, 163, 184, 0.35)` | Borde del panel de cristal (con espacios; mismo valor con otro formato que 8491) |
| 8595 | `rgba(255, 255, 255, 0.96)` | Superficie del panel de cristal |

### 1.5 Sin dueño (1)

`OportunidadesPage:1928`: `rgba(0, 120, 70, 0.05)`, franja de filas pares del grid. `#007846` no está en la marca, en `functional.ts` ni en Tailwind. Es el único verde de esa tabla, y su hover y su selección son slate y azul de marca.

## 2. Qué no se propone

- No unificar valores iguales con roles distintos (por ejemplo, el velo de carga 0.6 y el borde de chat 0.6) ni valores parecidos (`0.08` y `0.10` del azul).
- No unificar formatos (`rgba(148,163,184,0.35)` y `rgba(148, 163, 184, 0.35)` quedan como dos tokens, o como uno con dos formatos explícitos).
- No reemplazar `rgba(0,0,0,0.6)` por `palette.text.secondary`, ni los blancos por `common.white` con `alpha()`: cambiaría el string, y con `alpha()` también el formato.
- No tocar los 12 `alpha(...)` dinámicos, el legado ni el color de BD de `documentoRowAppearance`.

## 3. Propuesta (pendiente de confirmación)

### 3.1 Helper de marca con formato

Se extiende `theme/brand/derived.ts` sin cambiar lo que ya produce:

```ts
type AlphaFormat = 'spaced' | 'compact';
/** alpha como string conserva '0.10' y '0.20' tal cual. */
export function rgbaFromHex(hex: string, alpha: number | string, format: AlphaFormat = 'spaced'): string;
export const brandBlueAlpha = (alpha: number | string, format?: AlphaFormat) => rgbaFromHex(activeBrand.colors.blue.base, alpha, format);
export const brandBeigeAlpha = (alpha, format?) => rgbaFromHex(activeBrand.colors.beige.base, alpha, format);
export const brandAccentAlpha = (alpha, format?) => rgbaFromHex(activeBrand.colors.accent, alpha, format);
```

`brandBlueAlpha(0.06)` sigue dando `rgba(29, 47, 104, 0.06)`. Una prueba fija los usos actuales (`DocumentosFormPage` s8).

### 3.2 Tintes de marca (17): dos opciones (D-T1)

- **Opción A (recomendada): tokens con nombre en `theme/tints.ts`**, `brandTints = buildBrandTints(brand)`. Por ejemplo:
  - `focusRow`, `focusRowSelected`, `focusRowSelectedHover`, `focusRowBorder` y `focusPulseEnd` (`DocumentosDesktopView`);
  - `gridRowSelected` y `gridRowSelectedHover` (Oportunidades);
  - `activeItem` y `activeItemHover` (partidas);
  - `drawerBorder` e `iconWash` (`VersionUpdateDrawer`);
  - `noteSurface` (AI reportes) y `outlineButtonBorder` (resumen flotante);
  - `onChromeSeparator` y `onChromeMutedIcon` (beige);
  - `accentWash`.
  - Valores iguales con roles distintos (`0.08` ×3, `0.10` ×2) quedan como tokens separados. Es el mismo criterio que en elevación.
- **Opción B: helper en el sitio**, por ejemplo `brandBlueAlpha('0.10')` o `brandBlueAlpha(0.05, 'compact')`. Es más simple y también sigue a la marca, pero el rol no queda nombrado.

### 3.3 Funcionales (4)

- `alertTints.errorHover` = `rgbaFromHex(alertColors.error[600], 0.08)` → `rgba(220, 38, 38, 0.08)`. Con espacios, coincide byte a byte. Se usa ×2.
- `environmentColors.defaultBackground` = `'rgba(255,255,255,0.16)'` y `defaultBorder` = `'rgba(255,255,255,0.28)'`. Completan la familia del bloque 9.

### 3.4 Estructurales (33): `overlayColors` en `structural.ts`

Strings literales, un token por rol. El mismo valor solo se comparte si el rol es el mismo:

```ts
export const overlayColors = {
  onDark: {
    gridHeaderSeparator: 'rgba(255,255,255,0.25)',   // ×2
    railSelectedHover: 'rgba(255,255,255,0.14)',     // ×2
    selectionBarDivider: 'rgba(255,255,255,0.2)',    // ×2
    mutedLabel: 'rgba(255,255,255,0.7)',             // ×2 (resumen flotante y DFP)
    iconHover: 'rgba(255,255,255,0.12)',
    tabHighlight: 'rgba(255,255,255,0.16)',          // moduleTabBar, dentro de la sombra compuesta
  },
  chat: {
    ownBubbleBorder: 'rgba(255,255,255,0.6)',        // ×2
    ownBubbleSurface: 'rgba(255,255,255,0.15)',      // ×2
    otherBubbleSurface: 'rgba(0,0,0,0.04)',
  },
  media: {
    imageButton: 'rgba(0,0,0,.45)', imageButtonHover: 'rgba(0,0,0,.7)',
    imageBadge: 'rgba(0,0,0,0.55)',
  },
  veils: { loading: 'rgba(255,255,255,0.6)' },
  glass: {
    drawerSurface: 'rgba(255, 255, 255, 0.98)', closeButton: 'rgba(255,255,255,0.92)', closeButtonHover: 'rgba(255,255,255,1)',
    closeButtonBorder: 'rgba(15, 23, 42, 0.08)',
    summarySurface: 'rgba(255, 255, 255, 0.96)',
    summaryBorder: 'rgba(148,163,184,0.35)', summaryPanelBorder: 'rgba(148, 163, 184, 0.35)',
    summaryDivider: 'rgba(148,163,184,0.25)', summaryTotalBorder: 'rgba(148,163,184,0.4)',
  },
  hover: { gridMenuItem: 'rgba(15, 23, 42, 0.06)', gridRow: 'rgba(15, 23, 42, 0.04)' },
  text: { fieldCaption: 'rgba(0,0,0,0.6)' },
  pulse: { recentStart: 'rgba(56, 189, 248, 0.24)' },
};
```

Las cifras finales se verifican contra HEAD antes de migrar; no se redondea nada.

## 4. Plan por bloques (tras confirmación)

| # | Bloque | Usos | Notas |
|---|---|---|---|
| T1 | Tintes de marca (azul, beige, acento) y extensión de `rgbaFromHex` | 17 | Depende de D-T1. Prueba con marca alternativa: solo cambian estos |
| T2 | Funcionales (`alertTints.errorHover`, `environmentColors.default*`) | 4 | Ajusta la prueba del bloque 9, que fija esos blancos como literales |
| T3 | Estructurales fuera de `DocumentosFormPage` | 27 | Fixture por línea; incluye la parte blanca de `moduleTabBar` |
| T4 | `DocumentosFormPage` (cristal y etiqueta) y `#007846` según D-T3 | 6 + 1 | Baja de 16 a 10 los literales del cierre de la página: solo quedan blancos `#fff` / `#ffffff` |

Cada bloque lleva:
- fixture por línea en `colorMigrations.ts`;
- equivalencia SHA-256 contra HEAD;
- transformación;
- mutación (también de formato: `0.10` → `0.1`);
- cierre.

Además: `tsc` (213 preexistentes), build y `git diff --check`.

## 5. Riesgos

1. **Formato:** el helper actual normaliza el alfa (`0.10` → `0.1`) y siempre usa espacios. Sin el formato de §3.1, 6 de los 17 usos de marca cambiarían de string.
2. **`!important`** en `DocumentosDesktopView`: el token reemplaza solo el color, dentro de una plantilla (`${brandTints.focusRow} !important`).
3. **Sombra compuesta** de `moduleTabBar`: solo se extrae el blanco; el `color-mix` sigue igual.
4. **Pruebas previas que fijan literales:** el cierre de `DocumentosFormPage` (16), los literales conservados del bloque 9 (`RuntimeEnvironmentIndicator`) y el cierre neutral. Se actualizan con la misma técnica de E3 y E4: leer el archivo tal como lo dejó su bloque.
5. **Seguir a la marca cambia el comportamiento futuro, no el actual:** los tintes azules de una marca futura acompañarían a su azul. Hoy no.

## 6. Decisiones que necesito

- **D-T1.** Tintes de marca: ¿tokens con nombre (`theme/tints.ts`, opción A) o helper en el sitio (opción B)?
- **D-T2.** ¿Apruebas que los tintes beige y acento (3) sigan a la marca, igual que el azul?
- **D-T3.** Franja verde `#007846` de Oportunidades: ¿token estructural fijo (`overlayColors.stripe.legacyGreen`) o se deja literal como pendiente de diseño?
- **D-T4.** El inicio del pulso (sky-400): ¿estructural fijo, como propone §3.4?

## 7. Decisiones y estado

- **D-T1, opción A:** tokens con nombre en `theme/tints.ts` (`buildBrandTints(brand)` / `brandTints`). No se unifican valores ni formatos. Los valores repetidos son roles distintos y una prueba los declara:
  - `focusRow` = `focusPulseEnd`;
  - `focusRowSelected` = `drawerBorder`;
  - `gridRowSelected` = `activeItemHover` = `iconWash`.
- `rgbaFromHex(hex, alpha, format)` admite el alfa como string, que conserva `'0.10'`, y el formato `compact`. Lo que ya producía no cambia (`brandBlueAlpha(0.06)` sigue siendo `rgba(29, 47, 104, 0.06)`).
- Fuera de alcance, sin cambios: `Menu.tsx` (2 azules con alfa) y `Layout.tsx` (legado), el código que arma colores (`FormatosImpresionPage`, `SeleccionEmpresaPage`) y los 12 `alpha(...)` que ya leen el tema.

### 7.1 T1 — literales migrados (completado)

17 reemplazos en 9 archivos:

| Archivo:línea (HEAD `2a96ab6`) | Literal | Token |
|---|---|---|
| `DocumentosDesktopView:308` | `'rgba(29, 47, 104, 0.10) !important'` | `` `${brandTints.focusRow} !important` `` |
| `DocumentosDesktopView:311` | `'rgba(29, 47, 104, 0.16) !important'` | `` `${brandTints.focusRowSelected} !important` `` |
| `DocumentosDesktopView:314` | `'rgba(29, 47, 104, 0.20) !important'` | `` `${brandTints.focusRowSelectedHover} !important` `` |
| `DocumentosDesktopView:317, 318` | `'1px solid rgba(29, 47, 104, 0.24)'` | `` `1px solid ${brandTints.focusRowBorder}` `` |
| `DocumentosDesktopView:328` | `'rgba(29, 47, 104, 0.10)'` | `brandTints.focusPulseEnd` |
| `OportunidadesPage:1934` | `'rgba(29, 47, 104, 0.08)'` | `brandTints.gridRowSelected` |
| `OportunidadesPage:1937` | `'rgba(29, 47, 104, 0.12)'` | `brandTints.gridRowSelectedHover` |
| `CotizacionPartidasTab:156` | `'rgba(29, 47, 104, 0.06)'` | `brandTints.activeItem` |
| `CotizacionPartidasTab:159` | `'rgba(29, 47, 104, 0.08)'` | `brandTints.activeItemHover` |
| `VersionUpdateDrawer:51` | `'1px solid rgba(29, 47, 104, 0.16)'` | `` `1px solid ${brandTints.drawerBorder}` `` |
| `VersionUpdateDrawer:86` | `'rgba(29, 47, 104, 0.08)'` | `brandTints.iconWash` |
| `AIReportesPage:243` | `'rgba(29,47,104,0.05)'` | `brandTints.noteSurface` (compacto) |
| `FacturaResumenFlotante:328` | `'1px solid rgba(29,47,104,0.5)'` | `` `1px solid ${brandTints.outlineButtonBorder}` `` (compacto) |
| `MovimientosTable:1296` | `'rgba(244, 240, 232, 0.55)'` | `brandTints.onChromeSeparator` |
| `BuscadorMovimientos:133` | `'rgba(244,240,232,0.72)'` | `brandTints.onChromeMutedIcon` (compacto; el blanco de la misma línea queda para T3) |
| `SeccionImagenesArchivos:37` | `'rgba(0,98,97,0.1)'` | `brandTints.accentWash` (compacto) |

Pendientes:
- T2: funcionales (4).
- T3: estructurales (27).
- T4: `DocumentosFormPage` (6). El verde `#007846` y el pulso sky-400 dependen de D-T3 y D-T4.
