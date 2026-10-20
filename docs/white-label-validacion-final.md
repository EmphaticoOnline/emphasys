# Validación final White Label (PE-109)

> Rama `feature/white-label` · 2026-10-19 · Base de la validación: HEAD `5798a74` (57 commits sobre `main`, que no tiene commits nuevos desde el merge-base).
> No cambia la apariencia de Emphasys: los fixtures congelados de tokens, temas MUI, `index.html` y manifest siguen byte-idénticos.

## 1. Resultado

| Verificación | Resultado |
|---|---|
| Paridad de tokens y temas MUI (clásico y experimental) contra los fixtures congelados | ✅ byte-idénticos (`brandParity.test.ts`) |
| Paridad de `index.html` y manifest | ✅ |
| Equivalencia SHA-256 contra HEAD de cada bloque migrado (neutrales, menores, restos, `DocumentosFormPage` s1–s8, signo b1–b4, elevación E1–E4, tintes T1–T4, restos R1, blancos W1–W6) | ✅ |
| **Cierre global de colores:** fuera de `theme/`, Compass, mockups y legado solo quedan las exclusiones documentadas (33 al validar; 32 tras resolver D-T3) | ✅ (`whiteLabelClosure.test.ts`, nuevo) |
| **Marca alternativa (pruebas):** tokens, temas, sombras, degradados, tintes, `index.html` y manifest siguen a `acmeBrand`, salvo 7 coincidencias funcionales documentadas | ✅ (`whiteLabelBrand.test.ts`, nuevo) |
| **Marca alternativa (build real):** `vite build` con `acmeBrand` activa, en una copia temporal | ✅ Solo quedan 23 apariciones documentadas (H3 corregido) |
| `node --test` | ✅ 162/162 |
| `tsc --noEmit` | ✅ 213 errores preexistentes, 0 nuevos |
| `npm run build` | ✅ |
| `git diff --check` | ✅ |
| Revisión visual en navegador | ⏳ Manual (§4.2) |

## 2. Hallazgos

### H1 — Los tokens por defecto no leían la marca activa (corregido)

`tokens.ts` construía `classicTokens` y `experimentalTokens` con `emphasysBrand`, no con `activeBrand`. Lo mismo pasaba con `MAIN_NAV_TYPE`, `EDITORIAL_FIGURE_FAMILY` y `FUNCTIONAL_FONT_FAMILY`. Cambiar la marca en `active.ts` no habría cambiado los temas.

**Corrección:** ahora leen `activeBrand`. Con Emphasys activa el resultado es idéntico, y los fixtures lo confirman.

### H2 — 15 tintes de marca escritos a mano en `tokens.ts` (corregido)

`rgba` sobre el marfil (`frame.muted/subtle/controlBorder`), el grafito (selección de navegación y grid del clásico), el azul (`hoverTint` y selección del clásico), el beige (navegación del experimental) y la tinta (`hoverTint` y grid del experimental). Una marca nueva no los cambiaba.

**Corrección:** se derivan con `rgbaFromHex`, conservando el formato (`compact` y el alfa como string), con el mismo criterio que D-E1 y D-T1. Con Emphasys producen el mismo string; el fixture de tokens lo verifica.

La prueba nueva `whiteLabelBrand.test.ts` falla con el `tokens.ts` anterior (3 de 6 pruebas), así que detecta ambos hallazgos.

### H3 — Los mockups se incluían en el build de producción (corregido)

`App.tsx` importa de forma estática 5 páginas de `src/dev-mockups/`, que tienen ruta. En el build con `acmeBrand`, **76 de las 99 apariciones restantes de colores de Emphasys vienen de esos mockups**. Un despliegue white label mostraría pantallas con la identidad de Emphasys si alguien navega a esas rutas.

**Corrección (aprobada):** `App.tsx` carga los 6 mockups con `React.lazy`, dentro de `import.meta.env.DEV ? { … } : null`, y monta sus 6 rutas `/dev/mockups/*` solo dentro de `{devMockups && (…)}`.
- **Producción:** Vite reemplaza `DEV` por `false`. El bundle ya no contiene rutas `/dev/mockups` ni contenido de mockups, y el JS baja unos 140 KB (4 851 420 → 4 711 605 bytes). Una URL `/dev/mockups/*` cae en el comodín existente.
- **Desarrollo:** `transformRequest('/src/App.tsx')` conserva los 6 `import()` dinámicos y las rutas con los mismos paths.
- **Ninguna otra ruta cambió:** los 138 `path` de `App.tsx` son idénticos y están en el mismo orden.
- Prueba: `whiteLabelClosure.test.ts` (H3) exige que no haya imports estáticos de `dev-mockups`, que los 6 imports dinámicos y `lazy` estén solo en la rama `DEV` y que las rutas de mockups estén solo dentro del bloque de desarrollo. Falla con el `App.tsx` anterior.
- Build con `acmeBrand` después de la corrección: los colores de Emphasys que quedan pasan de 99 a **23**, todos documentados: 13 de `functional.ts`, 7 de datos o fallbacks de BD y 3 de KPI o serie.

### Colores de Emphasys que quedan en el bundle de Acme (atribuidos con sourcemaps)

| Origen | Apariciones | Clase |
|---|---|---|
| `src/dev-mockups/*` (6 archivos) | 76 | H3 |
| `theme/functional.ts` | 13 | Coincidencias funcionales y paletas categóricas, que por diseño no siguen a la marca |
| `FormatosImpresionPage`, `ConceptosPage`, `leadsDerivation` | 7 | Datos o fallbacks de BD |
| Historial de precios ×2 y serie de movimientos | 3 | KPI y serie |
| CSS | 0 | — |

En el build de Acme sí cambian el título (`Acme ERP`), el `theme-color` (`#0b4f6c`) y el manifest (`name`, `short_name`, colores). Los 22 colores de Acme aparecen en el bundle de Acme y en ninguno de Emphasys.

## 3. Cómo repetir la prueba de build con otra marca

Se hace en una copia temporal, sin tocar el repositorio:

1. Copiar `frontend/` sin `node_modules` ni `dist`, y enlazar `node_modules`.
2. Copiar `tsconfig.json` de la raíz y enlazar `backend/`: el frontend importa `backend/src/shared`.
3. En la copia, `src/theme/brand/active.ts` → `export { acmeBrand as activeBrand } from '../__fixtures__/acmeBrand.ts';`.
4. Ejecutar `npx vite build --sourcemap --outDir <tmp>`.
5. Buscar los hex de `emphasysBrand.colors`, como hex y como `rgb(a)`, en `assets/*.js|css`, y atribuirlos a su archivo fuente con `source-map-js`.

## 4. Checklist de no regresión

### 4.1 Automática (en cada cambio de tema o de componentes)

- [ ] `node --test src/theme/*.test.ts src/pages/*.test.ts`. Debe incluir:
  - `brandParity`, que congela la apariencia de Emphasys;
  - `whiteLabelBrand`, que comprueba que otra marca cambia toda la identidad derivada;
  - `whiteLabelClosure`, que exige que no haya colores escritos a mano fuera de las exclusiones;
  - los cierres por bloque.
- [ ] `npx tsc --noEmit -p .` sin errores nuevos (base: 213 preexistentes).
- [ ] `npm run build` correcto.
- [ ] `git diff --check` limpio.
- [ ] Un color nuevo en un componente debe salir de una capa (`brand`, `functional`, `structural`, `elevation`, `tints`). Si no, el cierre global falla y hay que documentar la excepción en `DOCUMENTED`.
- [ ] Un bloque de migración nuevo debe registrar su fixture en `colorMigrations.ts` (`LATER_CHAIN`), para que las pruebas anteriores reviertan primero los bloques posteriores.

### 4.2 Manual (antes de integrar)

En los temas clásico y experimental, con Emphasys activa, comparar contra `main`:
- [ ] Sidebar y barra superior: grafito, ítem seleccionado, botón "Nuevo" y sombra del rail.
- [ ] Workspaces de documentos (facturas, cotizaciones, notas, pagos, traslados, recepción y OC): rail, selección, menú contextual y acciones flotantes.
- [ ] `DocumentosFormPage`: encabezado, captura, partidas, totales, resumen flotante de cristal, chip fiscal, anticipos y recepciones.
- [ ] Tesorería y contabilidad: signos de importes, saldos, vencimientos y conciliación (incluido el spinner de los botones).
- [ ] CRM y leads: oportunidades (encabezado azul del grid, filtros y estatus), seguimiento de actividad, chat (burbujas y adjuntos), chips de filtro, temperatura y WhatsApp.
- [ ] Informes: KPI, Kardex, vencimientos e historial de precios.
- [ ] Vistas móviles: tarjetas, estado vacío, FAB y botón atrás.
- [ ] Indicador de entorno (producción, pruebas y default) y drawer de actualización de versión.

## 5. Pendiente para cerrar el proyecto

- ~~Decisiones de diseño D1–D9, D-T3 y D-B4~~: resueltas el 2026-10-19 (`docs/white-label-decisiones-diseno.md`). Cuatro cambian la apariencia a propósito (D1, D2, D4 y D6), y la revisión visual debe tenerlas en cuenta.
- **Revisión visual manual** (§4.2).
- **PE-108:** marca en el backend (PDFs, correos, plantillas de WhatsApp).
- **Integración:** estrategia para los 58 commits sobre `main`, contando el de esta validación (merge o squash, PR y revisión). `main` no tiene commits nuevos desde el merge-base.
- Los 213 errores de `tsc` son preexistentes y quedan fuera de alcance.
