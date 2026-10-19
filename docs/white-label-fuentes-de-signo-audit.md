# Auditoría — Fuentes de color de signo (importes negativos y saldos a cargo)

> Rama `feature/white-label` · HEAD `09cbc52` · 2026-10-18 · Solo diagnóstico: no se modificó código.
> Parte de PE-107 (sigue abierta).

## 0. Resumen

- **Seis significados distintos** se pintan hoy en tonos rojizos, verdes o ámbar según el signo o el estado de un importe: saldo negativo o a cargo, flujo de salida o entrada, vencimiento, variación de precio, deducción en documentos y signo contable.
- Vienen de **tres fuentes**:

  | Fuente | Usos de signo | Valor efectivo | ¿Cambia con el tema? |
  |---|---|---|---|
  | A. `palette` de MUI (`'error.main'`, `'success.main'`, `'warning.main'`) | 29 | `#d32f2f` / `#2e7d32` / `#ed6c02` | No |
  | B. `theme.emphasys.action.destructive` (y `metric.applied.foreground` para lo positivo) | 14 | Clásico `#b91c1c` · **experimental `#8a4d45`** | **Sí** |
  | C. Tokens funcionales (`accountingColors`, `inventoryFlowColors`, `documentSummaryTones`, `alertColors`, `agingBucketColors`) | 37 | Fijos (`#dc2626`, `#b91c1c`, `#16a34a`, `#b45309`, `#9a3412`, `#9a5b00`…) | No |

- Todas las pantallas que usan la fuente B como signo están en rutas del **tema experimental** (`/finanzas`, `/contabilidad`, `/productos`, `/inventario/movimientos`). Ahí el negativo se ve hoy en **`#8a4d45`**.
- **Un importe negativo se ve hoy en seis rojos distintos** según la pantalla: `#d32f2f`, `#8a4d45`, `#b91c1c`, `#dc2626`, más los tonos de deducción `#b45309` y `#9a3412`. No son equivalentes visualmente, así que **no se unifican**.
- **Los tres tonos `#b45309`, `#9a3412` y `#9a5b00` no son "negativos"**: son *deducciones* que reducen un total (descuentos y retenciones). Tienen significados distintos entre sí (ver §3), así que se mantienen como roles separados.

## 1. Inventario por fuente

### A. `palette` de MUI — 29 usos de signo

Valor fijo en ambos temas: `error.main` `#d32f2f`, `success.main` `#2e7d32`, `warning.main` `#ed6c02`. `palette` no se personaliza (ver `feedbackTokens`).

| Significado | Archivo:línea | Regla |
|---|---|---|
| Saldo negativo o a cargo (10) | `pages/informes/EstadoCuentaPage.tsx:641` | saldo final > 0 → error, < 0 → success |
| | `pages/informes/finanzas/PosicionTesoreriaPage.tsx:57, 192` | saldo < 0 → error |
| | `pages/DocumentosPage.tsx:2327` | saldo 0 → success, ≠ 0 → error (suspendido → warning) |
| | `components/documentos/DocumentosMobileView.tsx:162` | saldo 0 → success, ≠ 0 → error |
| | `modules/contabilidad/SaldosInicialesView.tsx:130` | importe negativo → error |
| | `pages/DocumentosFormPage.tsx:6050` | total < anticipos registrados → error |
| | `pages/informes/OCPendientesPage.tsx:132, 248` | pendiente > 0 → error |
| | `pages/informes/inventario/ExistenciasPorAlmacenPage.tsx:102` | existencia < 0 → error, ≥ 0 → success |
| Flujo de entrada / salida (3) | `pages/finanzas/ConciliacionBancariaPage.tsx:397` | depósito → success, retiro → error |
| | `pages/informes/finanzas/MovimientosNoConciliadosPage.tsx:84` | depósito → success, retiro → error |
| | `pages/informes/inventario/MovimientosInventarioPage.tsx:97` | entrada → success, salida → error |
| Vencimiento (8) | `pages/informes/finanzas/VencimientosClientesPage.tsx:71, 98, 214` | días < 0 → error, = 0 → warning; total vencido → error |
| | `pages/informes/finanzas/VencimientosProveedoresPage.tsx:92, 139, 280` | ídem |
| | `pages/finanzas/ProgramacionPagosPage.tsx:122` | días < 0 → error, = 0 → warning |
| | `modules/finanzas/ProgramacionMasivaDrawer.tsx:314` | vencida → error |
| Variación de precio (8) | `pages/informes/ventas/HistorialPreciosVentaPage.tsx:254, 256, 376, 377` | sube → error, baja → success; máximo → error, mínimo → success |
| | `pages/informes/compras/HistorialPreciosCompraPage.tsx:254, 256, 376, 377` | ídem |

### B. `action.destructive` como signo — 14 usos

> Corrección del 2026-10-18: `InventarioMovimientoFormPage:1344` es el hover del botón "Eliminar partida" (acción destructiva), no flujo de salida. Se excluye y la fuente B queda en 14 usos.

`action.destructive` es un rol de **acción destructiva** (botones de eliminar, errores). Aquí se usa también como color de signo:

| Significado | Archivo:línea | Regla | Valor hoy (experimental) |
|---|---|---|---|
| Importe o saldo negativo (10) | `modules/contabilidad/contabilidadVisual.ts:297` (`importeSx`, 4 usos: `SaldosMesView`, `SaldosAnioView`, `AuxiliarCuentaDrawer` ×2) | negativo → destructive | `#8a4d45` |
| | `pages/InventarioMovimientosPage.tsx:500` (`importeSx` local, 2 usos: 956, 965) | salida o negativo → destructive | `#8a4d45` |
| | `components/productos/ProductoHistorialComercial.tsx:308, 407, 474, 514` | importe < 0 o nota de crédito → destructive | `#8a4d45` |
| | `components/productos/ProductoWorkspace.tsx:767` | cantidad < 0 → destructive, > 0 → `metric.applied` | `#8a4d45` |
| | `pages/InventarioMovimientoFormPage.tsx:1497` | unidades < 0 → destructive | `#8a4d45` |
| | `modules/finanzas/MovimientosTable.tsx:861` | saldo < 0 → destructive, > 0 → `metric.applied` | `#8a4d45` |
| | `modules/finanzas/FinanzasPage.tsx:144` | neto < 0 → destructive, > 0 → `metric.applied` | `#8a4d45` |
| Flujo de salida (3) | `pages/InventarioMovimientoFormPage.tsx:880, 886` | tipo salida → destructive | `#8a4d45` |
| | `modules/finanzas/MovimientosTable.tsx:705` | retiro → destructive | `#8a4d45` |
| Vencido (1) | `pages/finanzas/ProgramacionPagosPage.tsx:515` | total vencido → destructive | `#8a4d45` |

Excluidos por **no ser signo** (son validación o error y se quedan en `action.destructive`):
- `PolizaFormView:724` (póliza no cuadrada);
- `LiquidacionResumenFooter:22, 77, 156` (exceso);
- `FilaCapturaMovimiento:484` (campo en alerta);
- los mensajes de error y los botones o iconos de eliminar (~40 usos).

### C. Tokens funcionales existentes — 37 usos de signo

| Token | Significado | Usos | Valores |
|---|---|---|---|
| `accountingColors.debit` / `credit` | Cargo y abono en estado de cuenta | 6 (`EstadoCuentaPage`: función de signo y 2 columnas) | `#dc2626` / `#16a34a` |
| `accountingColors.negativeAmount` | Importe negativo en vistas SAT | 3 (`AuxiliaresSatView` ×2, `BalanzaXmlView`) | `#b91c1c` |
| `accountingColors.favorable` / `unfavorable` | Utilidad o pérdida y balance cuadrado o con diferencia | 6 (`EstadoResultados`, `BalanceGeneral`) | `#ecfdf5`/`#166534` · `#fef2f2`/`#b91c1c` |
| `inventoryFlowColors` | Entrada / salida de inventario | 4 (`KardexProducto`, `MovimientosInventario`) | `#16a34a` / `#dc2626` |
| `documentSummaryTones` (deducciones) | Descuentos y retenciones | 11 (`DocumentosFormPage`) | `#b45309`, `#9a3412`, `#9a5b00` |
| `alertColors.warning/success` | Saldo pendiente o liquidado de factura; pendiente de recibir | 3 (`FacturaPagosDrawer:447`, `DocumentosFormPage:8555, 8564`) | `#b45309`/`#15803d`, `#92400e` |
| `agingBucketColors` | Antigüedad de saldos | 4 valores, 3 usos (`CarteraVencidaPage`) | `#388e3c` → `#7b1fa2` |

## 2. ¿Equivalentes visualmente o con función distinta?

| Comparación | ¿Equivalente? | Nota |
|---|---|---|
| Saldo a cargo en `EstadoCuentaPage`: filas `accountingColors.debit` `#dc2626` vs saldo final `'error.main'` `#d32f2f` | **No** (rojos distintos en la misma pantalla) | Mismo significado y distinto valor. Unificar cambia la apariencia: **decisión de diseño**. |
| Salida de inventario: Kardex `inventoryFlowColors.outbound` `#dc2626` vs `MovimientosInventarioPage` `'error.main'` `#d32f2f` vs formulario `action.destructive` `#8a4d45` | **No** | Mismo significado en tres valores. |
| Negativo en contabilidad: `importeSx` `#8a4d45` vs vistas SAT `negativeAmount` `#b91c1c` vs `SaldosInicialesView` `'error.main'` `#d32f2f` | **No** | Mismo significado en tres valores, dentro del mismo módulo. |
| Vencido: `ProgramacionPagosPage:122` `'error.main'` vs `:515` `action.destructive` | **No** | Misma pantalla, dos valores. |
| Pendiente: `OCPendientes` `'error.main'` (rojo) vs recepción en `DocumentosFormPage` `alertColors.warning[800]` (ámbar) | **No**, y además con **función distinta** | En OC es "falta recibir" en rojo; en recepción es "pendiente" en ámbar. |
| Deducciones `#b45309` / `#9a3412` / `#9a5b00` vs negativos rojos | **Función distinta** | Reducen un total; no indican déficit ni error. |
| `action.destructive` en botones vs en signo | **Función distinta** | Hoy comparten valor por diseño del tema experimental. Separarlos permite cambiar uno sin el otro. |

### Los tres tonos de deducción

| Tono | Rol actual | Dónde | Significado |
|---|---|---|---|
| `#b45309` | `documentSummaryTones.itemDiscount`, `withholding` | Resúmenes del documento | Descuento de partidas y retenciones del resumen |
| `#9a3412` | `documentSummaryTones.globalDiscount`, `discount` | Resúmenes del documento | Descuento global (y descuento combinado en el flotante) |
| `#9a5b00` | `documentSummaryTones.withholdingInline` | Panel de impuestos y partidas | Retención dentro del desglose fiscal de la captura |

Conclusión: **son tres roles distintos** (descuento por partida, descuento global y retención en el desglose fiscal) y ya están separados. Se mantienen. Que la retención del resumen (`#b45309`) y la del desglose (`#9a5b00`) difieran es una inconsistencia de presentación; unificarla es una decisión de diseño.

## 3. Propuesta de estructura final (pendiente de confirmación)

Principio: **un token por significado, sin cambiar ningún valor efectivo**. Las inconsistencias de §2 quedan como roles distintos documentados; unificarlas sería un paso posterior y explícito.

### 3.1 Signo dependiente del tema (fuente B → helper semántico)

Nuevo `theme/sign.ts`. No cambia `EmphasysTokens` ni los fixtures del tema:

```ts
/** Color de signo que hoy sigue al tema: negativo = action.destructive, positivo = metric.applied.foreground. */
export function amountSignColor(theme: Theme, sign: 'negative' | 'positive'): string;
/** Flujo de salida (inventario, retiros) en pantallas con tema. */
export function outflowColor(theme: Theme): string;
/** Total vencido en pantallas con tema. */
export function overdueColor(theme: Theme): string;
```

Cada función devuelve exactamente el rol que hoy usa el componente. Los 14 usos de la fuente B pasan a nombrar su significado. Los botones y errores siguen con `action.destructive`. Así, una marca podrá cambiar el color de "eliminar" sin cambiar el de "saldo negativo".

**Alternativa (no recomendada por ahora):** agregar un grupo `sign` a `EmphasysTokens`. Es más limpio a largo plazo, pero modifica los fixtures de tokens y del tema MUI (cambio aditivo que habría que aceptar explícitamente).

### 3.2 Signo fijo (fuentes A y C → familias en `functional.ts`)

| Familia nueva | Claves | Valores actuales | Reemplaza a |
|---|---|---|---|
| `balanceColors` | `due`, `settled`, `onHold` | `feedbackTokens.error.main`, `.success.main`, `.warning.main` | Los 10 usos de saldo negativo o a cargo de la fuente A |
| `cashFlowColors` | `inflow`, `outflow` | `success.main` / `error.main` de MUI | Los 3 usos de flujo de la fuente A |
| `dueDateColors` | `overdue`, `dueToday` | `error.main` / `warning.main` | Los 8 usos de vencimiento de la fuente A |
| `priceVarianceColors` | `up`, `down`, `max`, `min` | `error.main` / `success.main` | Los 8 usos de variación de precio de la fuente A |
| *(existentes)* `accountingColors`, `inventoryFlowColors`, `documentSummaryTones`, `agingBucketColors` | sin cambios | sin cambios | Fuente C (ya migrada) |

Reemplazar `'error.main'` por `feedbackTokens.error.main` cambia la referencia (de la `palette` de MUI al registro funcional) pero **no el valor**. Ese desacople es intencional: si en el futuro se personaliza `palette.error`, el signo no cambiará con él.

### 3.3 Lo que no se propone

- No unificar `#d32f2f`, `#dc2626`, `#b91c1c` ni `#8a4d45`.
- No mover las deducciones a "negativo": siguen en `documentSummaryTones`, con sus tres tonos.
- No tocar `alertColors` en los conteos de errores y advertencias: son estados de validación, no signo.

## 4. Plan de migración propuesto (tras confirmación)

| # | Bloque | Archivos | Usos | Riesgo |
|---|---|---|---|---|
| 1 | `theme/sign.ts` + fuente B | `contabilidadVisual`, `InventarioMovimientosPage`, `InventarioMovimientoFormPage`, `ProductoHistorialComercial`, `ProductoWorkspace`, `MovimientosTable`, `FinanzasPage`, `ProgramacionPagosPage` | 14 | Medio: depende del tema; probar con los dos temas |
| 2 | `balanceColors` | `EstadoCuentaPage`, `PosicionTesoreriaPage`, `DocumentosPage`, `DocumentosMobileView`, `SaldosInicialesView`, `DocumentosFormPage`, `OCPendientesPage`, `ExistenciasPorAlmacenPage` | 10 | Bajo |
| 3 | `cashFlowColors` + `dueDateColors` | Conciliación, no conciliados, movimientos de inventario, vencimientos ×2, programación ×2 | 11 | Bajo |
| 4 | `priceVarianceColors` | `HistorialPrecios*` | 8 | Bajo |

## 5. Riesgos

1. **Fusión semántica accidental:** el mismo hex significa cosas distintas (`#d32f2f` es error, a cargo, salida, vencido y precio al alza). Cada línea necesita un plan explícito hex → token, como en `DocumentosFormPage`.
2. **Dependencia del tema:** la fuente B cambia de valor entre temas. Sustituirla por un valor fijo cambiaría la apariencia en experimental (`#8a4d45` → `#b91c1c` o `#d32f2f`). Por eso se propone un helper que lee el mismo rol del tema.
3. **Strings de `palette`:** `'error.main'` lo resuelve MUI en tiempo de render. El token resuelve el mismo valor solo mientras `palette.error` no se personalice. `feedbackTokens.test` ya exige esa igualdad.
4. **Atributos JSX de color MUI** (`color="error"` en `Typography`/`Chip`/`Icon`): hoy apuntan a `palette` y no aceptan un hex directo en todos los componentes (por ejemplo `CheckCircleIcon color="success"` en `DocumentosPage:2362`). Se dejan fuera de este bloque.
5. **Conflictos con `main`:** en las referencias locales no hay commits nuevos desde el merge-base del 2026-10-15. Son ~25 archivos; conviene sincronizar antes de cada bloque.

## 6. Pruebas necesarias

1. **Equivalencia contra HEAD** por bloque (fixture por línea y SHA-256), en la cadena `LATER_FIXTURES`.
2. **Transformación y mutación** con el resolvedor genérico (`entriesTokenMap`, `colorTokenRoots`), agregando las familias nuevas.
3. **Helper de tema:** `amountSignColor(classicTheme, 'negative') === '#b91c1c'` y `(experimentalTheme) === '#8a4d45'`; lo mismo con `outflowColor` y `overdueColor`. Además, que cada uno sea idéntico al rol que reemplaza (`action.destructive`, `metric.applied.foreground`).
4. **Paridad de MUI:** `balanceColors`, `cashFlowColors`, `dueDateColors` y `priceVarianceColors` iguales a `classicTheme.palette.*.main` y `experimentalTheme.palette.*.main`.
5. **Separación:** un test de "inconsistencias conocidas" que fije los valores distintos de §2. Así una unificación futura será siempre explícita.
6. **Paridad global:** fixtures de tokens y temas MUI byte-idénticos; `tsc` (213 preexistentes), `npm run build`, `git diff --check`.

## 7. Decisiones que necesito

1. ¿Se aprueba la estructura de §3, con helper de tema (3.1) y familias fijas (3.2), sin unificar valores?
2. ¿Prefieres el helper (sin cambiar `EmphasysTokens`) o un grupo `sign` en `EmphasysTokens`, aceptando regenerar los fixtures?
3. ¿Se dejan documentadas las inconsistencias de §2 como pendientes de diseño, o quieres decidir ya alguna unificación? Por ejemplo, el saldo final del estado de cuenta `#d32f2f` contra las filas `#dc2626`.

## 8. Inconsistencias pendientes de diseño

Se **conservan tal cual** (sin unificar). Cada una necesita una decisión de diseño explícita, porque unificarla cambia la apariencia. Las pruebas fijan los valores actuales para que ninguna unificación ocurra por accidente.

| # | Inconsistencia | Valores actuales | Dónde | Opción de unificación (a decidir) |
|---|---|---|---|---|
| D1 | Saldo a cargo en una misma pantalla | filas `accountingColors.debit` `#dc2626` · saldo final `'error.main'` `#d32f2f` | `EstadoCuentaPage` | Un solo rol `balanceColors.due` para filas y saldo final |
| D2 | Salida de inventario en tres valores | Kardex `#dc2626` · `MovimientosInventarioPage` `#d32f2f` · formulario `#8a4d45` (tema) | Inventario | Elegir entre valor fijo o valor del tema para todo inventario |
| D3 | Importe negativo en contabilidad en tres valores | `importeSx` `#8a4d45` (tema) · vistas SAT `#b91c1c` · saldos iniciales `#d32f2f` | Contabilidad | Un solo rol de importe negativo en el módulo |
| D4 | Vencido en una misma pantalla | días `'error.main'` `#d32f2f` · total vencido `overdueColor` `#8a4d45` | `ProgramacionPagosPage` (122, 515) | Mismo rol para días y total vencido |
| D5 | "Pendiente" con función distinta | OC pendiente `'error.main'` (rojo) · recepción pendiente `alertColors.warning[800]` (ámbar) | `OCPendientesPage`, `DocumentosFormPage` | Decidir si "falta recibir" es error o advertencia |
| D6 | Retención en dos tonos | resumen `documentSummaryTones.withholding` `#b45309` · desglose fiscal `withholdingInline` `#9a5b00` | `DocumentosFormPage` | Un solo tono de retención (las deducciones siguen separadas de los negativos) |
| D7 | Positivo del tema clásico | `amountSignColor(classic, 'positive')` = `metric.applied.foreground` `#1f2937` (gris, no verde) | Rutas clásicas que usen estos helpers | Hoy no hay ninguna pantalla clásica que los use; revisar si se monta alguna |

## 9. Estado de los bloques

| # | Estado | Commit | Detalle |
|---|---|---|---|
| 1 | **Aplicado** | ver git log | `theme/sign.ts` con `amountSignColor`, `outflowColor`, `inflowColor` y `overdueColor`, que leen `action.destructive` y `metric.applied.foreground` del tema. 21 reemplazos en 8 archivos: los 14 usos de signo de la fuente B, sus 4 contrapartes positivas y 3 entradas. Se agregó `inflowColor`, que no estaba en §3.1: las mismas funciones que pintan la salida pintan la entrada (`colorSentido`, `colorCantidad`, columnas Retiro/Depósito), y migrar solo una mitad dejaba una asimetría. Valores sin cambio en ambos temas. Fixture `signColors.b1.baseline.json` (por línea, con reemplazos declarados); prueba `signColors.test.ts`. |
| 2 | Pendiente | — | `balanceColors` (fuente A, saldo negativo o a cargo, 10 usos) |
| 3 | Pendiente | — | `cashFlowColors` + `dueDateColors` (11 usos) |
| 4 | Pendiente | — | `priceVarianceColors` (8 usos) |
