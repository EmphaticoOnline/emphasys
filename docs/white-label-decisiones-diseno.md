# Decisiones de diseño pendientes — D1–D9, D-T3 y D-B4

> Rama `feature/white-label` · HEAD `f6e0b8c` · 2026-10-19 · Solo diagnóstico: no se migró nada.
> Cada decisión es independiente. La opción **A** de todas es "mantener", y hoy es lo que fijan las pruebas.

## Cómo leer el impacto

- **Tema:** el valor que se ve depende de la ruta (`resolveActiveTheme.ts`). `/informes/*` y `/crm/oportunidades` usan el tema clásico; `/finanzas`, `/contabilidad`, `/productos`, `/inventario/movimientos` y `/ventas|compras/<tipo>` usan el experimental. El rojo destructivo del tema es `#b91c1c` en el clásico y `#8a4d45` en el experimental.
- **ΔE2000**, diferencia perceptual entre el valor actual y el propuesto:
  - < 1: imperceptible;
  - 1–2: se nota comparando de cerca;
  - 2–10: se nota a simple vista;
  - > 10: otro tono.

## Resumen

| # | Qué decide | Pantallas | Impacto si se cambia | Recomendación |
|---|---|---|---|---|
| D1 | Saldo a cargo y a favor: filas vs. saldo final | Estados de cuenta (clásico) | Bajo en rojo (ΔE 2.3); medio en verde (ΔE 13.1) | B: el saldo final toma el color de las filas |
| D2 | Salida y entrada de inventario en tres valores | Kardex y movimientos (clásico); formulario (experimental) | Medio (ΔE 2.3–22.6) | B: un solo rol fijo en los informes; el formulario sigue al tema |
| D3 | Importe negativo en contabilidad en tres valores | Contabilidad (experimental) | Alto (ΔE 13–15) | Decisión de producto. Si se unifica, C |
| D4 | Vencido: días vs. total | Programación de pagos (experimental) | Alto (ΔE 15) | B: los días siguen al tema |
| D5 | "Pendiente": rojo o ámbar | OC pendientes (clásico); recepción en el formulario (experimental) | Alto (ΔE 17) | Decisión de producto |
| D6 | Retención en dos tonos | Formulario de documentos (experimental) | Medio (ΔE 9.1) | B: un solo tono |
| D7 | Positivo del clásico en gris | Ninguna hoy | **Ninguno hoy** | A: documentar |
| D8 | Antigüedad sin conciliar | Conciliación (experimental); no conciliados (clásico) | **Ninguno** (solo tokenizar) | B: `stalenessColors` |
| D9 | Variación del precio de venta con la lectura de compras | Historial de precios de venta (clásico) | Alto: rojo ↔ verde (ΔE 64.3) | Decisión de producto |
| D-T3 | Franja verde de Oportunidades | Oportunidades (clásico) | **Ninguno** | B: usar `grid.stripe` del tema |
| D-B4 | Blanco fijo en `configPrimaryButtonSx` | **Ninguna** (sin uso) | **Ninguno hoy** | B: leer `primaryForeground` (o C: eliminar) |

---

## D1 — Saldo a cargo y a favor en el estado de cuenta

- **Dónde:** `pages/informes/EstadoCuentaPage.tsx`, usado por `/informes/ventas/estado-cuenta-cliente` y `/informes/compras/estado-cuenta-proveedor`, con el tema clásico.
- **Hoy:**
  - las filas (importe con `colorSaldo`, l. 80–81, y columnas de cargo y abono, l. 212–213 y 352–353) usan `accountingColors.debit` `#dc2626` a cargo y `.credit` `#16a34a` a favor;
  - el **saldo al corte** (l. 641) usa `balanceColors.due` `#d32f2f` y `.inFavor` `#2e7d32`.
  - En la misma pantalla, el saldo final no tiene el mismo rojo ni el mismo verde que sus filas.

| Opción | Cambio visual exacto |
|---|---|
| A. Mantener | Ninguno |
| **B. El saldo final toma el color de las filas** | Solo el número del saldo al corte (1 elemento): rojo `#d32f2f` → `#dc2626` (ΔE 2.3, casi imperceptible) y verde `#2e7d32` → `#16a34a` (ΔE 13.1, verde más claro y saturado) |
| C. Las filas toman el color del saldo final | Todas las filas de importes, cargos y abonos: rojo `#dc2626` → `#d32f2f` (ΔE 2.3) y verde `#16a34a` → `#2e7d32` (ΔE 13.1, más oscuro). Muchos elementos |

Recomendación: **B**, porque toca un solo elemento.

## D2 — Salida y entrada de inventario

- **Dónde y hoy:**

| Pantalla | Ruta y tema | Salida | Entrada |
|---|---|---|---|
| Kardex (`KardexProductoPage:276, 279`) | `/informes/inventario/kardex`, clásico | `inventoryFlowColors.outbound` `#dc2626` | `.inbound` `#16a34a` |
| Movimientos, **tarjetas** de totales (`MovimientosInventarioPage:291–292`) | `/informes/inventario/movimientos`, clásico | `#dc2626` | `#16a34a` |
| Movimientos, **filas** (`MovimientosInventarioPage:97`) | ídem | `cashFlowColors.outflow` `#d32f2f` | `.inflow` `#2e7d32` |
| Formulario (`InventarioMovimientoFormPage:881, 887`) | `/inventario/movimientos/*`, experimental | `outflowColor` → `#8a4d45` | `inflowColor` → `#3f6b52` |

- La pantalla de movimientos mezcla dos rojos y dos verdes entre sus tarjetas y sus filas.

| Opción | Cambio visual exacto |
|---|---|
| A. Mantener | Ninguno |
| **B. Un solo rol fijo en los informes (`inventoryFlowColors`)** | Solo las filas de movimientos: salida `#d32f2f` → `#dc2626` (ΔE 2.3) y entrada `#2e7d32` → `#16a34a` (ΔE 13.1). Kardex, tarjetas y formulario no cambian |
| C. Todo inventario sigue al tema | Kardex, tarjetas y filas de movimientos pasan al rojo del clásico `#b91c1c` (ΔE 6.8–7.7). La entrada del clásico es gris `#1f2937` (ΔE 49.9, deja de ser verde; ver D7). No recomendado |

Recomendación: **B**.

## D3 — Importe negativo en contabilidad

- **Dónde y hoy** (todo en `/contabilidad`, tema experimental):
  - `importeSx` (`contabilidadVisual`, auxiliar de cuenta y pólizas): `#8a4d45` del tema;
  - vistas SAT (`AuxiliaresSatView:286, 295`, `BalanzaXmlView:75`): `accountingColors.negativeAmount` `#b91c1c`;
  - saldos iniciales (`SaldosInicialesView:131`): `balanceColors.negative` `#d32f2f`.

| Opción | Cambio visual exacto |
|---|---|
| A. Mantener | Ninguno |
| B. Todo sigue al tema (`amountSignColor`) | Vistas SAT `#b91c1c` → `#8a4d45` (ΔE 13.2) y saldos iniciales `#d32f2f` → `#8a4d45` (ΔE 15.0). Rojo terroso en lugar de rojo vivo |
| C. Un rojo fijo contable (`negativeAmount` `#b91c1c`) | `importeSx` `#8a4d45` → `#b91c1c` (ΔE 13.2) y saldos iniciales `#d32f2f` → `#b91c1c` (ΔE 6.8) |

Recomendación: es una decisión de producto, porque B y C cambian bastante. Si se unifica, **C** mantiene la lectura "rojo = negativo" que ya usan las vistas SAT.

## D4 — Vencido en programación de pagos

- **Dónde:** `pages/finanzas/ProgramacionPagosPage.tsx`, `/finanzas/programacion-pagos`, tema experimental.
- **Hoy:**
  - los días (l. 124) usan `dueDateColors.overdue` `#d32f2f`, y "vence hoy" usa `dueToday` `#ed6c02`;
  - el **total vencido** (l. 517) usa `overdueColor(tokens)` → `#8a4d45`.

| Opción | Cambio visual exacto |
|---|---|
| A. Mantener | Ninguno |
| **B. Los días siguen al tema** | Solo los días vencidos: `#d32f2f` → `#8a4d45` (ΔE 15.0). "Vence hoy" sigue en ámbar |
| C. El total usa el rojo fijo | Solo el total vencido: `#8a4d45` → `#d32f2f` (ΔE 15.0) |

Recomendación: **B**. Así queda consistente con el resto de tesorería experimental, donde el negativo ya es `#8a4d45`.

## D5 — "Pendiente de recibir": ¿error o advertencia?

- **Hoy:**
  - OC pendientes (`OCPendientesPage:133, 249`, `/informes/compras/oc-pendientes-recibir`, clásico): cantidad pendiente en `balanceColors.outstanding` `#d32f2f`, **rojo**;
  - recepciones en el formulario (`DocumentosFormPage:8510, 8556, 8565`, `/compras/recepcion`, experimental): pendiente en `alertColors.warning[800]` `#92400e`, **ámbar**.

| Opción | Cambio visual exacto |
|---|---|
| A. Mantener | Ninguno |
| B. Pendiente es advertencia | Informe de OC pendientes: `#d32f2f` → `#92400e` (ΔE 17.0), de rojo a ámbar oscuro, en 2 lugares |
| C. Pendiente es error | Recepción en el formulario: `#92400e` → `#d32f2f` (ΔE 17.0), en 3 lugares (incluido el chip "Parcial") |

Recomendación: es una decisión de producto. Si "falta recibir" es una situación normal del proceso, **B**.

## D6 — Retención en dos tonos

- **Dónde:** `pages/DocumentosFormPage.tsx`, `/ventas|compras/<tipo>`, tema experimental.
- **Hoy:**
  - resumen financiero (3 arreglos, l. 8357, 8427 y 8611): `documentSummaryTones.withholding` `#b45309`;
  - desglose fiscal por partida (l. 4773–4774 y 5494): `withholdingInline` `#9a5b00`.

| Opción | Cambio visual exacto |
|---|---|
| A. Mantener | Ninguno |
| **B. Un solo tono `#b45309`** | Desglose fiscal (3 textos): `#9a5b00` → `#b45309` (ΔE 9.1, un poco más claro) |
| C. Un solo tono `#9a5b00` | Resumen financiero (3 renglones): `#b45309` → `#9a5b00` (ΔE 9.1) |

Recomendación: **B**. Los descuentos (`#9a3412`) y los negativos siguen separados.

## D7 — Positivo del tema clásico en gris

- **Hoy:** `amountSignColor(classic, 'positive')` = `metric.applied.foreground` `#1f2937`, un gris oscuro y no verde. Todas las pantallas que usan los helpers de signo están en rutas experimentales (productos, contabilidad, finanzas, movimientos e inventario), donde el positivo es `#3f6b52`.
- **Impacto de cualquier opción hoy: ninguno.**

| Opción | Cambio visual exacto |
|---|---|
| **A. Mantener y documentar** | Ninguno |
| B. Positivo propio del clásico (p. ej. `#2e7d32`) | Ninguno hoy. Solo afectaría a una pantalla clásica futura que use los helpers (ΔE 40.4) |

Recomendación: **A**. Hay que revisarlo cuando una pantalla clásica use los helpers.

## D8 — Antigüedad de partidas sin conciliar

- **Hoy:** días > 30 en `'error.main'` `#d32f2f` y > 7 en `'warning.main'` `#ed6c02`.
  - `ConciliacionBancariaPage:441` (`/finanzas`, experimental);
  - `MovimientosNoConciliadosPage:166, 505` (`/informes/finanzas/…`, clásico).
- Son las únicas lecturas de color de signo que siguen como rutas de `palette`.

| Opción | Cambio visual exacto |
|---|---|
| A. Mantener (`palette`) | Ninguno |
| **B. Tokenizar como `stalenessColors` `{ stale, aging }`** | **Ninguno**: mismos valores, con nombre propio y separado de vencimiento y flujo |

Recomendación: **B**. Solo da nombre al rol.

## D9 — Variación del precio de venta

- **Dónde:** `pages/informes/ventas/HistorialPreciosVentaPage.tsx`, `/informes/ventas/historial-precios`, clásico.
- **Hoy:** usa la lectura de compras:
  - variación que sube en rojo y que baja en verde (l. 255, 257, `priceVarianceColors.up/down`);
  - precio máximo en rojo y mínimo en verde (l. 377–378).
  - En ventas, que el precio suba suele ser favorable.

| Opción | Cambio visual exacto |
|---|---|
| A. Mantener | Ninguno |
| B. Invertir solo en ventas | Sube `#d32f2f` → `#2e7d32`, baja `#2e7d32` → `#d32f2f`, máximo rojo → verde y mínimo verde → rojo (ΔE 64.3: colores opuestos), en 4 líneas. Compras no cambia |

Recomendación: es una decisión de producto, porque cambia el significado y no solo el tono.

## D-T3 — Franja verde del grid de Oportunidades

- **Dónde:** `pages/OportunidadesPage.tsx:1929`, `/crm/oportunidades`, tema clásico. Filas pares en `rgba(0, 120, 70, 0.05)`.
- **Corrección de la auditoría de tintes:** el valor no está "sin dueño". Es **exactamente `classicTokens.grid.stripe`**, el mismo rol (filas pares de un DataGrid) en el mismo tema. `standardDataGridSx` ya lee `theme.emphasys.grid.stripe` para ese rol. El hover de la misma tabla (`overlayColors.hover.gridRow`) también coincide con `grid.hover`.

| Opción | Cambio visual exacto |
|---|---|
| A. Mantener literal | Ninguno |
| **B. Leer `theme.emphasys.grid.stripe`** | **Ninguno hoy** (mismo valor en el clásico). Si la ruta se homologa al experimental, la franja seguirá a ese tema |
| C. Franja neutra (p. ej. `steel.rowStripe` `#f4f6f9`) | La franja pierde su tinte verde: cambio visible en todas las filas pares |

Recomendación: **B**. Se puede aplicar lo mismo al hover: `grid.hover` en lugar de `overlayColors.hover.gridRow`, también sin cambio visual.

## D-B4 — `configPrimaryButtonSx`

- **Dónde:** `components/configuracion/configVisual.tsx:142`. Usa blanco fijo (`onPrimaryColors.text`) sobre `theme.emphasys.action.primary`. En el experimental, el tema define `action.primaryForeground` en beige `#f4f0e8`.
- **Hallazgo:** el export **no tiene ningún uso** en el código (verificado con `git grep`). **Impacto hoy: ninguno.**

| Opción | Cambio visual exacto |
|---|---|
| A. Mantener | Ninguno |
| **B. Leer `theme.emphasys.action.primaryForeground`** | Ninguno hoy. Si se usa en el futuro, el texto será blanco en el clásico y beige en el experimental, como los botones del tema |
| C. Eliminar el export sin uso | Ninguno |

Recomendación: **B**, consistente con los botones del tema. C también es válida.

---

## Cómo responder

Basta con una línea por decisión, por ejemplo: `D1 B, D2 B, D3 A, D4 B, D5 B, D6 B, D7 A, D8 B, D9 A, D-T3 B, D-B4 B`.

Cada decisión aprobada se aplicaría en un commit pequeño, con:
- fixture por línea, con el cambio de valor declarado;
- prueba que fije el valor nuevo;
- actualización de la prueba que hoy fija el valor anterior;
- `tsc`, build y `git diff --check`.

Las opciones sin cambio visual (D8 B, D-T3 B y D-B4 B) además conservan la paridad contra HEAD.

## Estado de las decisiones

Respuesta del 2026-10-19: `D1 B, D2 B, D3 A, D4 B, D5 A, D6 B, D7 A, D8 B, D9 A, D-T3 B, D-B4 B`. Se aplica una por commit, empezando por las que no cambian la apariencia.

| # | Decisión | Estado |
|---|---|---|
| D3, D5, D7, D9 | A (mantener) | Sin cambios. Las pruebas siguen fijando los valores actuales |
| D8 | B | ✅ `stalenessColors` (`stale` / `aging`), mismos valores que `palette.error/warning.main`. 3 líneas en conciliación y movimientos no conciliados |
| D-T3 | B | ✅ La franja de filas pares de Oportunidades lee `theme.emphasys.grid.stripe`. En el tema clásico de `/crm/oportunidades` vale exactamente `rgba(0, 120, 70, 0.05)`. Ya no queda en las exclusiones del cierre global (quedan 32) |
| D-B4 | B | ✅ `configPrimaryButtonSx` lee `theme.emphasys.action.primaryForeground` y se eliminó su import sin uso de `onPrimaryColors`. El export no tiene usos, así que no hay cambio visual |
| D1 | B | ✅ **Cambio visual:** el saldo al corte del estado de cuenta usa `accountingColors.debit` / `.credit`, igual que sus filas. Solo cambia ese número: rojo `#d32f2f` → `#dc2626` (ΔE 2.3) y verde `#2e7d32` → `#16a34a` (ΔE 13.1). `balanceColors.due` sigue usándose en documentos; `inFavor` queda sin uso actual y se conserva |
