# Guía — Agregar una marca white label

> Estado validado en `feature/white-label` (PE-109). La marca default es Emphasys y su apariencia está congelada por fixtures.

## 1. Qué es marca y qué no

| Capa | Archivo | ¿Cambia con la marca? |
|---|---|---|
| **Marca:** azul, grafito, beige, marfil, tinta, acento, tipografías, logos, favicon, metadata | `src/theme/brand/*.ts` | **Sí.** Es lo único que se define por cliente |
| Derivados de marca: tokens de identidad, temas MUI, sombras (`brandElevation`), degradados (`brandGradients`), tintes (`brandTints`), `index.html`, manifest | `tokens.ts`, `elevation.ts`, `tints.ts`, `brand/derived.ts`, `brand/webIdentity.ts` | **Sí, automáticamente.** No se editan |
| Funcional: éxito, advertencia, error, info, estados, métricas, signo, terceros (WhatsApp, Excel, PDF), categóricos | `src/theme/functional.ts` | **No.** Aunque hoy algunos coincidan con el azul Emphasys (`action.info`, `metric.*`, `reportKpis`, `avatars`) |
| Estructural: neutrales, superficies y velos blancos, contraste sobre primario, sombras fijas | `src/theme/structural.ts`, `elevation` | **No** |
| Datos de usuario o BD (colores de etiquetas, etapas, conceptos y formatos de impresión) y sus fallbacks | Componentes | **No.** Son datos |

## 2. Pasos

1. **Crear la definición** `src/theme/brand/<cliente>.ts`, con `BrandDefinition` completo (`brand/types.ts`). Toma como plantilla `brand/emphasys.ts` o el fixture de prueba `src/theme/__fixtures__/acmeBrand.ts`.
   - `colors`: todos los roles (`blue`, `graphite`, `beige`, `ivory`, `ink`, `accent`) como hex de 6 dígitos (`#rrggbb`), porque `rgbaFromHex` solo acepta ese formato.
   - `typography`: `functional`, `navigation` y `editorialFigure`.
   - `metadata`: `title`, `appName`, `shortName`, `description`, `themeColor` y `backgroundColor`.
   - `assets`: logo, isotipo, favicon, apple-touch-icon, manifest e iconos de 16 a 512 px.
2. **Assets:**
   - logos en `src/assets/`;
   - favicon, iconos y apple-touch-icon en `public/`, con las rutas declaradas en `assets`.
3. **Activar la marca** en dos lugares, porque Vite necesita imports estáticos:
   - `src/theme/brand/active.ts`: `export { <cliente>Brand as activeBrand } from './<cliente>.ts';`
   - `src/theme/brand/logos.ts`: los imports de `logo` y `logoMark` deben apuntar a los archivos que declara la marca.
4. **Verificar** (§3). No hay que tocar componentes, tokens ni temas.

## 3. Verificación de una marca nueva

1. `node --test src/theme/*.test.ts src/pages/*.test.ts`. Con una marca activa distinta de Emphasys, **fallan a propósito** las pruebas que congelan la apariencia de Emphasys (`brandParity`: fixtures de tokens y temas, `index.html` y manifest, "la marca activa por default es Emphasys"). Las de la capa funcional, la estructural y los cierres deben pasar.
2. `npx tsc --noEmit -p .`: sin errores nuevos respecto de la base.
3. `npm run build` y revisar `dist/index.html` (title y `theme-color`) y `dist/manifest.webmanifest`.
4. **Contraste:** `onPrimaryColors` (texto blanco sobre el primario) es fijo (D-B1, opción A). Con un azul de marca claro, el texto blanco puede quedar ilegible. Hay que comprobar al menos un contraste de 4.5:1 entre `colors.blue.base` y `#ffffff`.
5. **Revisión visual** de los temas clásico y experimental (checklist en `docs/white-label-validacion-final.md`, §4).

## 4. Qué no seguirá a la marca (a sabiendas)

- **Coincidencias funcionales** con el azul y la tinta de Emphasys:
  - tema clásico: `action.info`, `metric.amount.foreground`, `metric.available.foreground` y `metric.progress`;
  - tema experimental: `metric.amount.*` y `metric.track`.
  - Además las paletas categóricas `reportKpis`, `avatars` y `series`. Si una marca quiere que sigan su azul, es una decisión de diseño, no una configuración.
- **Datos guardados en BD:** colores iniciales de etiquetas (`#25D366`), de etapas, de conceptos y de formatos de impresión, más sus fallbacks.
- **Legado sin importadores** (`Layout`, `Menu`, `Sidebar`, `SecondaryNav`) y **mockups** (`src/dev-mockups/`). Los mockups sí se incluyen hoy en el build de producción (ver la validación final, hallazgo H3).
- **Backend** (PDFs, correos, plantillas de WhatsApp): pendiente de PE-108.
