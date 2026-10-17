# Auditoría de diseño — Proyecto White Label

> Rama: `feature/white-label` · Fecha: 2026-10-17 · Alcance: `frontend/src` (sin cambios de código)
>
> Objetivo: dimensionar cuánto del frontend depende de la identidad Emphasys y proponer cómo
> hacerla reemplazable sin alterar la apariencia default de Emphasys.

---

## 0. Resumen ejecutivo

- **Ya existe una base sólida de tokens**: `theme/tokens.ts` define `EmphasysTokens` (13 grupos de roles:
  `frame`, `navigation`, `documentNav`, `canvas`, `content`, `action`, `table`, `grid`, `metric`, `status`,
  `chat`, `workspaceRail`) con dos juegos de valores (`classicTokens`, `experimentalTokens`), una fábrica
  (`createEmphasysTheme`) y un resolvedor de tema por ruta (`resolveActiveTheme.ts`). Esto es, de facto,
  una capa **semántica** — falta la capa de **marca** por debajo.
- **Los tokens ya se usan mucho**: ~1,170 referencias a `theme.emphasys.*` en 159 archivos
  (758 de `content`, 179 de `action`).
- **Pero conviven con mucho valor hardcodeado**: ~1,720 literales hex (297 colores distintos) y ~230
  `rgb/rgba()` en 113 archivos; ~2,100 `fontSize` numéricos y ~1,100 `fontWeight` literales.
  El azul institucional `#1d2f68` aparece 105 veces fuera de su token.
- **La identidad visual no es solo color**: logos en `src/assets` y `public/`, nombre "Emphasys" en
  textos de UI, `index.html` (`<title>`, `theme-color`), `manifest.webmanifest`, favicons y `sw.js`.
- **Dimensión estimada**: ~25–35 días-persona para white label completo de frontend; un MVP de marca
  (logo + nombre + color primario + cromado) cabe en ~4–6 días.
- **Regla rectora**: cada fase debe ser **paridad visual 1:1** con Emphasys default. Tokenizar no es
  rediseñar: un literal se reemplaza por un token *cuyo valor default es exactamente ese literal*,
  aunque hoy esté "mal" en el tema experimental.

---

## 1. Archivos analizados

| Área | Archivos clave | Observación |
|---|---|---|
| `theme/` | `tokens.ts` (369 l.), `createEmphasysTheme.ts`, `themes.ts`, `resolveActiveTheme.ts`, `AppThemeGate.tsx`, `augmentation.ts`; `src/theme.ts` | Núcleo del sistema actual |
| Entrada | `main.tsx`, `App.tsx`, `index.html`, `public/manifest.webmanifest` | Fuentes cargadas con `@fontsource`; tema clásico en raíz, `AppThemeGate` por ruta |
| Layout | `components/layout/SidebarLayout.tsx` (632 l.), `components/layout/moduleTabBar.ts`, `components/layoutConstants.ts`, `components/SecondaryNav.tsx`, `components/Layout.tsx` y `components/Menu.tsx` (legacy) | **No existe `src/layouts/`**; el layout vive en `components/layout/` |
| Componentes base | `components/grids/standardDataGridSx.ts`, `EmphasysDataGrid.tsx`, `components/status/*` | Ya consumen tokens; buenos modelos |
| `pages/` | 36 páginas raíz + `informes/`, `configuracion/`, `finanzas/` (105 archivos) | 528 hex en 37 archivos |
| `modules/` | `contabilidad`, `finanzas`, `documentos`, `cotizaciones`, `crm`, `productos`, `configuracion` (99 archivos) | 215 hex en 17 archivos |
| `components/` | 136 archivos | 454 hex en 49 archivos |
| `assets/` | `emphasys-w.png`, `emphasys-colibri-w.png`, `logo-transparente.png`; `public/emphazul_*.png`, `public/logos/logo-emphasys.jpg`, `favicon.ico` | Importados directamente por `SidebarLayout` y `Menu` |
| Aislados | `compass/` (81 archivos, Tailwind + `compass.css` con variables propias), `pages/login.css` (oklch, Manrope/Space Grotesk), `dev-mockups/` (15 archivos, 359 hex) | Sistemas visuales separados |

### Concentración de literales hex (top)

| Archivo | Hex |
|---|---|
| `pages/DocumentosFormPage.tsx` (9,039 l.) | 147 |
| `pages/OportunidadesPage.tsx` | 80 |
| `components/crm/ActividadSeguimientoDrawer.tsx` | 56 |
| `components/documentos/nota-credito/NotaCreditoCaptura.tsx` | 41 |
| `modules/finanzas/AplicarSaldoNotaCreditoDialog.tsx` | 37 |
| `pages/DocumentosPage.tsx` | 36 |
| `pages/informes/EstadoCuentaPage.tsx` | 31 |
| `components/documentos/DocumentosMobileView.tsx` | 24 |
| `components/Layout.tsx` (legacy) | 24 |
| `pages/informes/MovimientosPorPeriodoPage.tsx` | 22 |
| `components/produccion/ProduccionDetalleDrawer.tsx` | 22 |
| `components/documentos/facturas/FacturaResumenFlotante.tsx` | 22 |

Por bloque: `components/documentos` 164 · `pages/informes` 141 · `modules/contabilidad` 108 ·
`modules/finanzas` 86 · `components/crm` 70 · `components/cfdi-sat` 36 · `components/productos` 28 ·
`pages/configuracion` 11.

---

## 2. Inventario visual

### 2.1 Colores — tokens definidos (`tokens.ts`)

| Familia | Clásico | Experimental |
|---|---|---|
| Cromado (sidebar/topbar) | `#2c3344` (compartido, `STRUCTURAL_CHROME`) | `#2c3344` |
| Primario de acción | `#1d2f68` / hover `#162551` | `#3c4149` / hover `#2c3138` |
| Fondo de página | `#eef1f4` | `#f4f0e8` |
| Superficie de contenido | `#ffffff` | `#f7f4ee`, elevada `#fffaf2`, well `#fffcf8` |
| Texto | `#1f2937` / `#4b5563` / `#6b7280` | `#3e3428` / `#5c5348` / `#7a7268` |
| Borde | `#e5e7eb` | `#e4ddd2` |
| Info | `#1d2f68` | `#3d5f86` |
| Destructivo | `#b91c1c` | `#8a4d45` |
| Header de grid | `#2c3344` | `#3c4149` |
| Métricas (experimental) | — | applied `#3f6b52`, available `#3d5f86`, blocked `#8a4d45`, amount `#3e3428` |
| Estado | draft `#facc15`, cancelación `#d97706` (iguales en ambos) | |
| Indicador `documentNav` | `#006261` (verde petróleo) | `#3e3428` |

### 2.2 Colores — literales más repetidos fuera de tokens

| Valor | Usos | Rol de facto |
|---|---|---|
| `#1d2f68` | 105 | Azul institucional (primario clásico) |
| `#fff` / `#ffffff` | 145 | Superficie / texto sobre primario |
| `#e5e7eb` | 72 | Borde clásico |
| `#92400e`, `#b45309`, `#fffbeb`, `#fef3c7` | 52 / 17 / 20 / 7 | Advertencia (ámbar) |
| `#b91c1c`, `#dc2626`, `#fef2f2`, `#fee2e2` | 48 / 12 / 12 / 6 | Error / destructivo |
| `#166534`, `#16a34a`, `#dcfce7`, `#f0fdf4` | 26 / 12 / 8 / 7 | Éxito |
| `#f8fafc`, `#64748b`, `#475569`, `#334155`, `#94a3b8`, `#0f172a` | 46 / 44 / 39 / 30 / 28 / 21 | Escala *slate* (Tailwind) |
| `#6b7280`, `#111827`, `#9ca3af`, `#4b5563`, `#374151` | 37 / 27 / 26 / 24 / 19 | Escala *gray* (Tailwind) |
| `#8b93a7`, `#5b6479`, `#3d4557`, `#d9dde6` | 28 / 9 / … | Grises azulados propios (encabezados de tabla, labels) |
| `#f4f0e8`, `#f7f4ee`, `#3e3428`, `#3c4149`, `#2c3138` | 19 / 13 / 10 / 14 / 10 | Valores experimentales copiados a mano |
| `#25d366` | 12 | Verde WhatsApp (marca de tercero) |
| `#7c3aed` | 9 | Violeta de informes de inventario (`const COLOR` en 5 páginas) |
| `#1565c0`, `#1976d2`, `#2e7d32`, `#d32f2f`, `#ed6c02` | 9 / … | Paleta default de MUI copiada |
| `#0f766e`, `#006261` | 11 / 12 | Verde petróleo |

**Diagnóstico**: hay al menos **cuatro escalas de gris** mezcladas (Tailwind *gray*, Tailwind *slate*, grises
azulados propios, beige experimental) y **dos paletas funcionales** (Tailwind 600/700/800 y MUI default).

### 2.3 Tipografía

| Elemento | Valor |
|---|---|
| Familia funcional | Roboto (`FUNCTIONAL_FONT_FAMILY`), pesos 300–700 vía `@fontsource` |
| Menú principal | Source Sans 3 (`MAIN_NAV_TYPE`: 15px, 500/700) |
| Cifras editoriales | `EDITORIAL_FIGURE_FAMILY` (Iowan Old Style/Palatino) solo en experimental; variante `figure` (114 usos) |
| Monoespaciada | `'monospace'` literal 34× + 3 variantes `ui-monospace…` |
| Otros | `'Instrument Serif'`, `'Iowan Old Style…'` literal 2× (fuera del token) |
| Login / Compass | Manrope, Space Grotesk (no cargadas por `@fontsource`) |

- `fontSize` literal: **~2,100** usos. Escala real: 13 (513), 12 (318), 11 (256), 12.5 (136), 16, 18, 14,
  10, 10.5, 11.5, 15, 17, 13.5… → **>20 tamaños**, varios de medio píxel.
- `fontWeight` literal: 700 (634), 600 (177), 650 (114), 800 (90), 500, 750, 400, 550.
- `letterSpacing`: 0.08em, -0.02em, 0.14em, 0.06em, 0.12em, 0.04em. `uppercase` en ~224 sitios
  (patrón "eyebrow label": 11px / 700 / 0.06–0.08em / `#8b93a7`).

### 2.4 Espaciado

Se usa la escala MUI (`theme.spacing`, base 8px) casi siempre: `1` (683), `1.5` (507), `2` (424),
`0.5` (335), `1.25` (205), `3`, `0.75`, `0.25`… Solo 15 paddings/márgenes en px literales.
**No es un problema de white label** (el espaciado no es identidad); se documenta, no se migra.

Dimensiones estructurales: `SIDEBAR_WIDTH 220`, `SIDEBAR_COLLAPSED_WIDTH 100`, `TOPBAR_HEIGHT 56`,
`MOBILE_APPBAR_HEIGHT 44`, grid header 38 / fila 34, `canvas.inset/radius` en tokens.

### 2.5 Bordes y radios

- Radios: `2` (277 → 16px), `1.5` (98), `1` (98), `'10px'` (57), `99`/`999`/`'50%'` (152, píldoras/avatares),
  `3`, `'6px'`, `'4px'`. Mezcla de unidades de spacing y px.
- Bordes: patrón dominante `1px solid <gris>` con el gris hardcodeado; en archivos tokenizados
  `1px solid ${tokens.content.border}`.

### 2.6 Sombras y elevación

- `boxShadow: 'none'` (54) y `elevation={0}` (19): el lenguaje es plano.
- Sombras literales: `0 1px 2px rgba(0,0,0,…)` (cards seleccionadas), `0 16px 40px rgba(44,51,68,…)`
  (flotantes, usa el grafito), `0 18px 48px rgba(62,52,40,…)` (experimental), `inset 3px 0 0 ${primary}`
  (indicador lateral). 19 archivos usan `color-mix()`.
- **No hay tokens de sombra.**

### 2.7 Componentes y patrones visuales

| Patrón | Implementación | Estado |
|---|---|---|
| Cromado (sidebar + topbar) | `SidebarLayout` + `tokens.frame` / `MAIN_NAV_TYPE` | Tokenizado; logo importado directo |
| Tabs de módulo | `moduleTabBar.ts` + `documentNav` | Tokenizado |
| Data grid | `standardDataGridSx` + `tokens.grid` | Tokenizado (salvo separador `rgba(255,255,255,0.25)`) |
| Indicadores de estado | `components/status/*`, `status.semantics.ts` | Tokenizado vía palette + `status` |
| Chips de estado por dominio | `OportunidadesPage`, `estadoSeguimiento.ts`, `DocumentosPage`, `LeadsPage`, `CarteraVencidaPage` | **Hardcodeado**, duplicado en varios mapas |
| Resúmenes flotantes / KPIs | `FacturaResumenFlotante`, `ResumenFlotanteMarco`, `tokens.metric` | Mixto |
| Encabezados de informe | `pages/informes/*` | En migración (commits recientes) |
| Chat CRM | `tokens.chat` | Tokenizado |
| Paletas de gráficas | `ORIGIN_COLORS`/`COLORES` (idénticas, 2 archivos), `COLORES_MES`, `LEAD_AVATAR_COLORS`, `const COLOR='#7c3aed'` (5 archivos) | **Hardcodeado y duplicado** |
| Colores de usuario | Etapas de producción, etiquetas WhatsApp, formatos de impresión (vienen de BD) | **Datos, no tema** — no migrar |

---

## 3. Clasificación

| Categoría | Qué incluye | Debe ser reemplazable por marca |
|---|---|---|
| **Identidad Emphasys** | Azul `#1d2f68` (+ hover `#162551`, tints `#eef2ff`/`#e7eef8`); grafito `#2c3344` del cromado; logos (wordmark, colibrí, emphazul); nombre "Emphasys" en textos; `theme-color`; Source Sans 3 del menú; cifras editoriales serif | **Sí** |
| **Estructurales** (neutros del sistema) | Grafitos `#3c4149`/`#2c3138`, beige `#f4f0e8`/`#efe8dc`/`#e4ddd2`, marfil `#fbf7f1`/`#fffaf2`/`#f7f4ee`/`#fffcf8`, escalas gray/slate del clásico, bordes, fondos de página/canvas | Parcialmente (la marca define un *matiz* neutral; el default conserva estos valores) |
| **Funcionales** | Éxito (verdes), advertencia (ámbar), error (rojos), info, draft `#facc15`, cancelación `#d97706`, métricas aplicado/disponible/bloqueado | **No** por default (significado contable/operativo); se permite override fino solo con contraste validado |
| **Decorativos** | Paletas de gráficas, avatares de leads, violeta de informes de inventario, verde petróleo `#006261`/`#0f766e` como acento | Sí, como paleta categórica de marca |
| **De terceros** | Verde WhatsApp `#25d366`, paleta MUI default copiada | WhatsApp: **no** (marca ajena). MUI default: normalizar a funcionales |
| **Datos de usuario** | Colores de etapas, etiquetas, formatos de impresión | **No** (no es tema) |
| **Hardcodeados** | ~1,720 hex / ~230 rgba en 113 archivos de las categorías anteriores | Migrar a token según categoría |

---

## 4. Tokens existentes y duplicaciones

### Tokens existentes
- `EmphasysTokens` (semánticos por rol de superficie): bien diseñados, nombres estables, consumidos
  vía `theme.emphasys.*`.
- `palette.primary` derivada de `action.primary`; en experimental también `background`, `text`, `divider`.
- `MAIN_NAV_TYPE`, `EDITORIAL_FIGURE_FAMILY`, `FUNCTIONAL_FONT_FAMILY`, variante `figure`.
- `layoutConstants.ts`, `STANDARD_DATA_GRID_*`.

### Duplicaciones y deudas detectadas
1. **Valores repetidos dentro de `tokens.ts`**: `#1d2f68` 8×, `#f8fafc` 8×, `#f4f0e8` 9×, `#3e3428` 7× —
   no hay capa de primitivos, cada rol repite el hex.
2. **Clásico no reestiliza superficies** (`restyleSurfaces: false`): `palette.text/background/divider/error/success`
   quedan con valores MUI default, distintos de los grises que usan los tokens (`#1f2937` vs `rgba(0,0,0,0.87)`).
   Hay dos fuentes de verdad para "texto primario" en clásico.
3. **`palette.success/error/warning/info` sin definir** → MUI default (`#2e7d32`, `#d32f2f`, `#ed6c02`, `#0288d1`),
   mientras el código hardcodea los Tailwind (`#166534`, `#b91c1c`, `#92400e`). Tres "rojos de error" conviven.
4. **Paletas de gráficas duplicadas**: `VentasPorOrigenContactoPage` y `VentasPorVendedorPage` (idénticas);
   `const COLOR = '#7c3aed'` en 5 páginas de inventario.
5. **Mapas de estado por dominio duplicados**: `etapaChipColor` idéntico en `LeadsPage` y `LeadsMobileView`;
   chips de oportunidad con hex en `OportunidadesPage`.
6. **Grafito escrito a mano**: `rgba(44, 51, 68, …)` en sombras y selecciones fuera de tokens.
7. **`'monospace'` literal** en 34 sitios, sin token.
8. **Legacy**: `components/Layout.tsx` y `components/Menu.tsx` no tienen importadores en `src/`
   (24 hex + logo). **Decisión (2026-10-17): se conservan sin cambios, fuera del alcance white label**
   (ver §10).
9. **Tokens fantasma** del tipo `emphasys.cloud`/`emphasys.mx` en el conteo son strings, no tokens (sin acción).

---

## 5. Arquitectura White Label propuesta

Tres capas, de abajo hacia arriba. Los componentes **solo** leen la capa semántica (ya es así donde se
tokenizó), así que el cambio de marca no toca componentes.

```
BrandDefinition (por cliente)            ← capa de marca: lo único que cambia un white label
   │  primitivos + identidad + assets
   ▼
buildTokens(brand, variant)              ← capa semántica: EmphasysTokens actual (renombrable a AppTokens)
   │  classic | experimental
   ▼
createEmphasysTheme(tokens, options)     ← MUI Theme + theme.emphasys
   ▲
functionalTokens (fijos, compartidos)    ← capa funcional: éxito/advertencia/error/info/draft/…
```

### 5.1 Tokens de marca (`theme/brand/`)

```ts
type BrandDefinition = {
  id: string;                         // 'emphasys'
  name: string;                       // 'Emphasys' → textos UI, <title>, manifest
  primitives: {
    brand:   { 900: string; 800: string; 100: string; 50: string };  // azul #1d2f68, #162551, #e7eef8, #eef2ff
    chrome:  { base: string; raised: string; deep: string };          // grafito #2c3344, #3c4149, #2c3138
    neutralWarm: Scale;               // beige/marfil del experimental
    neutralCool: Scale;               // gray/slate del clásico
    accent?: string;                  // verde petróleo #006261
    categorical: string[];            // paleta de gráficas
  };
  typography: { body: string; nav: typeof MAIN_NAV_TYPE; figure: string; mono: string };
  assets: { logoFull: string; logoMark: string; favicon: string; appIcons: Record<number, string> };
  meta: { themeColor: string; manifestName: string; shortName: string };
};
```

`emphasysBrand` se escribe **con los valores exactos actuales**; es la definición default.

### 5.2 Tokens semánticos (existentes)
Se conserva `EmphasysTokens` tal cual (mismos nombres de rol), pero `classicTokens`/`experimentalTokens`
pasan a ser funciones `buildClassicTokens(brand)` / `buildExperimentalTokens(brand)` que referencian primitivos
en lugar de hex. Grupos a añadir conforme se migre:
- `content.label` (eyebrow `#8b93a7`), `content.mono` (familia), `elevation.{flat,raised,floating}`,
- `chart.categorical[]`, `avatar[]`,
- `radius.{sm,md,lg,pill}`, `type.{eyebrow,caption,body,title}` (fase posterior, ver riesgos).

### 5.3 Tokens funcionales (`theme/functional.ts`)
Independientes de marca y de variante salvo donde el experimental ya los suaviza:

```ts
functional: {
  success: { fg, bg, border }, warning: { fg, bg, border },
  error:   { fg, bg, border }, info:    { fg, bg, border },
  draft, cancellation, neutral: { fg, bg, border },
}
```
Valores default = los Tailwind que ya dominan el código (`#166534/#dcfce7/#86efac`, `#92400e/#fffbeb/#f59e0b`,
`#b91c1c/#fee2e2/#fecaca`…). Además se alimentan `palette.success/warning/error/info` **solo cuando la
fase lo autorice explícitamente**, porque hoy MUI default se ve en botones/alerts `color="error"` (83 usos).

### 5.4 Selección de marca
`resolveActiveTheme` ya separa "qué tema" de "por qué". Se añade un `BrandProvider`/`getActiveBrand()`
(fuente inicial: constante de build `VITE_BRAND=emphasys`; después configuración de empresa) y
`getThemeById(id, brand)` memoizado. `index.html`/`manifest` se generan por marca en build
(plugin Vite o plantilla), no en runtime.

---

## 6. Estrategia de migración

### Fases

| Fase | Contenido | Paridad visual |
|---|---|---|
| **0. Red de seguridad** | Snapshots visuales de referencia (Playwright, **dependencia nueva**: hoy no está instalado) de ~25 pantallas en clásico y experimental, desktop + móvil; script de conteo de hex (este informe) como métrica en CI | Línea base |
| **1. Capa de marca** | `BrandDefinition` + `emphasysBrand`; `tokens.ts` referencia primitivos; `tokens.ts` produce exactamente los mismos objetos (test de igualdad profunda) | 100% garantizada por test |
| **2. Identidad no cromática** | Logos vía `brand.assets`, nombre vía `brand.name`, `index.html`/manifest/favicons por marca, `MAIN_NAV_TYPE` desde marca | 1:1 |
| **3. Tokens funcionales** | `functional.ts`; migrar mapas de estado (chips, `estadoSeguimiento`, `OportunidadesPage`, `CarteraVencidaPage`, avisos ámbar) | 1:1 (mismos hex) |
| **4. Hardcodeados por bloque** | Reemplazo literal→token por bloque funcional (abajo) | 1:1 por bloque, validado con snapshots |
| **5. Tipografía/radios/sombras** | Tokens de escala; consolidar medios píxeles **solo** con aprobación visual | Cambio controlado (no paridad estricta) |
| **6. Segunda marca** | Marca de prueba (p. ej. "Acme") para validar que nada quede con identidad Emphasys | — |

### Bloques funcionales (orden sugerido para fase 4)

1. **Shell**: `SidebarLayout`, `moduleTabBar`, `SecondaryNav`, `EmpresaSelector`, `RuntimeEnvironmentIndicator`, `VersionUpdateDrawer`, `NotificationsSettingsDialog`.
2. **Componentes compartidos**: `grids/`, `status/`, `FloatingFormActions`, `MobileSaveFab`, `ActivityCard`, `DynamicFieldControl`.
3. **Informes** (`pages/informes`, 141 hex): ya en migración; paletas de gráficas a `chart.categorical`.
4. **Tesorería** (`modules/finanzas`, 86) y **Contabilidad** (`modules/contabilidad`, 108).
5. **CRM / Leads / Oportunidades** (`components/crm` 70, `OportunidadesPage` 80, `LeadsPage`).
6. **Documentos** (`components/documentos` 164, `DocumentosPage` 36, `DocumentosFormPage` 147) — el más grande y riesgoso; dividir por secciones del formulario.
7. **Productos, CFDI SAT, Producción, Configuración** (resto, ~100 hex).
8. **Excluidos / tratamiento aparte**: `dev-mockups/` (no migrar; excluir del conteo), `compass/` (sistema Tailwind independiente con sus propias variables CSS: puente opcional desde marca), `pages/login.css` (pantalla de login de Compass).

---

## 7. Estimación y riesgos

### Tamaño

| Fase | Esfuerzo (días-persona) |
|---|---|
| 0. Snapshots + métrica | 2–3 |
| 1. Capa de marca | 2 |
| 2. Identidad no cromática | 1.5–2 |
| 3. Funcionales | 2–3 |
| 4. Hardcodeados (~1,350 hex productivos + ~150 rgba en ~105 archivos) | 12–18 |
| 5. Tipografía/radios/sombras | 4–6 (opcional, requiere decisiones de diseño) |
| 6. Marca de prueba + QA | 2–3 |
| **Total** | **~25–35** (MVP de marca = fases 1–2: **~4–6**) |

### Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Regresión visual silenciosa**: muchas pantallas bajo rutas experimentales (`/ventas/factura`, `/finanzas`…) aún pintan grises clásicos hardcodeados (p. ej. `DocumentosFormPage`). "Corregir" al tokenizar cambiaría su look | Alto | Regla de paridad: el token nuevo toma el valor que *hoy se ve*; correcciones van en PR aparte y aprobadas |
| `palette.error/success/…` = MUI default en ambos temas; tocarlos cambia 83 `color="error"` + 50 `'error.main'` | Alto | No alimentar `palette` funcional hasta la fase 3 y con snapshots |
| Clásico con `restyleSurfaces:false`: `text.primary` MUI ≠ `content.foreground` | Medio | No unificar en esta iniciativa; documentar |
| `DocumentosFormPage.tsx` (9,039 l.) | Alto (conflictos de merge con `main`) | Migrar por secciones pequeñas; sincronizar con `main` antes de cada bloque |
| Rama de larga vida vs. desarrollo activo en `main` que sigue agregando hex | Medio | Script de conteo en CI que falle si sube; PRs pequeños y frecuentes |
| Medios píxeles / >20 tamaños de fuente | Medio | Fase 5 separada; no mezclar con color |
| Contraste de marcas de cliente (texto blanco sobre primario claro) | Medio | `buildTokens` calcula `primaryForeground` y valida WCAG AA en test |
| Assets PWA/`sw.js`/manifest son estáticos | Bajo-medio | Generación en build por marca |
| Branding fuera del frontend (PDF, correos, plantillas WhatsApp, CFDI) | Fuera de alcance | Auditoría backend aparte |
| `compass/` y `login.css` con sistemas propios (oklch, Manrope) | Bajo | Tratar como bloque independiente |

---

## 8. Criterios de aceptación — apariencia default de Emphasys

Con `brand = emphasys` (default), después de cada fase:

1. **Grafito**: cromado (sidebar y topbar) en todas las rutas = `#2c3344`; texto de menú `#efe6d8`;
   rail experimental `#3c4149`; header de grid clásico `#2c3344` y experimental `#3c4149`; primario
   experimental `#3c4149`/hover `#2c3138`; tooltips/snackbars experimentales en `#2c3344`.
2. **Beige**: fondo de página y `documentNav` experimental `#f4f0e8`; hover `#efe8dc`; bordes `#e4ddd2`;
   tint `#efe4d4`.
3. **Marfil**: contenido experimental `#f7f4ee`, elevado/diálogos/menús `#fffaf2`, well `#fffcf8`,
   seleccionado `#fbf7f1`; foreground `#f7f4ee`/`#f4f0e8` sobre grafito.
4. **Azul**: primario clásico `#1d2f68`/hover `#162551`/tint `#eef2ff`/wash `#e7eef8`; progreso de
   navegación `#1d2f68`; chat enviado `#1d2f68`; `theme-color` del navegador y manifest `#1d2f68`;
   info experimental `#3d5f86`.
5. **Colores funcionales**: draft `#facc15`, cancelación `#d97706`; métricas experimentales intactas
   (`#3f6b52`, `#3d5f86`, `#8a4d45`, `#7d9b86`, `#8fa4bf`); chips de éxito/advertencia/error con los mismos
   hex actuales; `palette.error/success/warning/info` sin cambios mientras no se apruebe; WhatsApp `#25d366`.
6. **Tema clásico**: `deepEqual(buildClassicTokens(emphasysBrand), classicTokensActual)`; opciones
   `editorialFigures:false`, `restyleSurfaces:false` preservadas.
7. **Tema experimental**: `deepEqual(buildExperimentalTokens(emphasysBrand), experimentalTokensActual)`;
   cifras serif editoriales; overrides de Dialog/Menu/Popover/Button/IconButton/TouchRipple intactos.
8. **Resolución por ruta**: `resolveActiveThemeId` devuelve el mismo tema para todas las rutas listadas hoy.
9. **Tipografía**: Roboto funcional, Source Sans 3 en menú (15px/500/700), mismos tamaños por pantalla.
10. **Identidad**: mismos logos (wordmark expandido 40px, colibrí colapsado 80px, `logoFilter`), mismo
    `<title>`, favicons y textos "Emphasys".
11. **Verificación**: diff de snapshots visuales = 0 px en las pantallas de referencia (tolerancia solo
    antialiasing); `tsc` y `vite build` sin errores; el conteo de hex productivos no aumenta.

---

## 9. Primeros bloques priorizados

| # | Bloque | Por qué primero | Tamaño |
|---|---|---|---|
| 1 | **Capa de marca + paridad por test** (`theme/brand/emphasys.ts`, primitivos, `tokens.ts` derivado, test de igualdad profunda contra snapshot JSON de los tokens actuales) | Cero riesgo visual, habilita todo lo demás, demostrable por test | S (≈2 días) |
| 2 | **Identidad no cromática** (logos, nombre, `index.html`, manifest, favicons vía marca; eliminar/aislar `Layout.tsx`/`Menu.tsx` legacy si se confirma que no se usan) | Es lo primero que un cliente white label ve | S (≈1.5–2 días) |
| 3 | **Snapshots visuales de referencia** (Playwright, clásico+experimental, desktop+móvil) | Red de seguridad para fases 3–4 | S–M (≈2–3 días) |
| 4 | **Tokens funcionales + mapas de estado** (`OportunidadesPage`, `estadoSeguimiento.ts`, `LeadsPage`/`LeadsMobileView`, `CarteraVencidaPage`, avisos ámbar) | Elimina duplicaciones y fija la semántica antes de tocar módulos | M (≈2–3 días) |
| 5 | **Shell + componentes compartidos** (`SidebarLayout`, `grids`, `status`) | Afecta todas las pantallas con poco código | S |
| 6 | **Informes** (continuar la línea de los commits recientes; `chart.categorical`) | Ya en curso, patrón probado | M |
| 7 | Tesorería → Contabilidad → CRM → Documentos | Por volumen y riesgo creciente | L |

### Propuesta de primer bloque de implementación

**Bloque 1 — Capa de marca con paridad demostrada.**

1. Crear `frontend/src/theme/brand/types.ts` (`BrandDefinition`) y `frontend/src/theme/brand/emphasys.ts`
   con primitivos extraídos de `tokens.ts` (azul, grafito, beige, marfil, gray/slate, acento, funcionales).
2. Antes de tocar `tokens.ts`, congelar `classicTokens` y `experimentalTokens` actuales en un fixture JSON.
3. Reescribir `classicTokens`/`experimentalTokens` como `build*Tokens(emphasysBrand)` exportando además las
   constantes actuales (mismos nombres) para no tocar consumidores.
4. Test con `node:test` + `node:assert/strict` (mismo patrón que `pages/inventarioMovimientosSeleccion.test.ts`;
   el frontend no tiene Vitest/Jest) que compare con el fixture.
5. Criterio de cierre: test verde, `tsc` + `vite build` limpios, diff del frontend limitado a `theme/`.

Sin cambios de UI, sin cambios en componentes, sin cambios de base de datos.

---

## 10. Fuera del alcance white label

### Código legado sin importadores

Decisión del 2026-10-17: estos componentes **se conservan tal como están** y **no se migran** a tokens
de marca, funcionales ni estructurales. No forman parte de la interfaz que se muestra, así que no afectan
la apariencia default de Emphasys ni la de una marca futura.

| Archivo | Líneas | Literales hex | Observaciones |
|---|---|---|---|
| `frontend/src/components/Layout.tsx` | 736 | 24 | Layout anterior; dejó de usarse en `e2ef809`, cuando se implementó `components/layout/SidebarLayout.tsx`. Importa `Menu`, `EmpresaSelector`, `navigationData` y `VersionUpdateDrawer`. |
| `frontend/src/components/Menu.tsx` | 121 | 7 | Solo lo importa `Layout`. Importa el logo `assets/emphasys-w.png` directamente, no a través de `brand/logos.ts`. |
| `frontend/src/components/Sidebar.tsx` | 97 | 8 | Sin importadores. Usa `#1d2f68` y `#006261` literales. |
| `frontend/src/components/SecondaryNav.tsx` | 61 | 5 | Sin importadores. Define `azul` y `verde` como constantes locales. |

Verificación: sin imports estáticos, dinámicos ni `lazy()` desde `src/` (los únicos `Menu` importados
en otros archivos son de `@mui/material`).

Consecuencias de conservarlos:

- `Layout.tsx` y `Sidebar.tsx` se editaron el 2026-10-14. Si alguno vuelve a montarse, **antes**
  hay que migrarlo con el mismo método por bloques (tokens + fixture + equivalencia contra HEAD),
  porque hoy tiene identidad Emphasys escrita a mano.
- `navigationData.ts` conserva `MODULE_TABS`, `MODULE_DESCRIPTIONS` y `MAIN_MENUS`, que solo usa este
  legado. `MAIN_MENU_LINKS` sí está en uso (`utils/rutaInicio.ts`).
- `src/assets/logo-transparente.png` no se importa en ningún lado; se conserva junto con el legado.
- `neutralColors.test.ts` verifica que estos archivos no aparezcan en los fixtures de neutrales,
  para que no se migren por accidente en esa familia.

### Otros elementos fuera del alcance

- Módulo Compass (`frontend/src/compass/`, `pages/login.css`): sistema visual propio (Tailwind, oklch).
- `frontend/src/dev-mockups/`: maquetas de desarrollo.
- Colores provenientes de la base de datos: estados, etapas de producción, etiquetas de WhatsApp,
  conceptos, formatos de impresión y sus valores por defecto.
- Branding fuera del frontend: PDF, correos, plantillas de WhatsApp y CFDI (backend).
