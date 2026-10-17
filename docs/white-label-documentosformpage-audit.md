# Auditoría de color — `DocumentosFormPage`

> Rama `feature/white-label` · HEAD `90e6063` · 2026-10-17 · Solo diagnóstico: no se modificó código.
>
> Archivo: `frontend/src/pages/DocumentosFormPage.tsx` (9,039 líneas). Todo el color escrito a mano está
> entre las líneas 3912 y 8966; las primeras ~3,900 líneas son lógica.

## 0. Contexto

- **Rutas:** `/ventas/:codigo/(nuevo|:id)` y `/compras/:codigo/(nuevo|:id)`. Según `resolveActiveTheme.ts`,
  la página se pinta con el **tema experimental** para `factura`, `cotizacion`, `nota_credito`,
  `pago_cliente`, `ajuste_cliente`, `traslado`, `orden_compra`, `recepcion`, `factura_compra`,
  `pago_proveedor`, `ajuste_proveedor` y `nota_credito_compra`, y con el **clásico** para los demás códigos.
- **Literales fijos:** los literales escritos a mano no cambian con el tema. Hoy se ven igual en ambos.
- **Tokens del tema que ya usa:** `'primary.main'` (21), `tokens.content.*`, `tokens.grid.*`,
  `tokens.metric.*`, `theme.emphasys.action.*` y `'error.main'` (2).

## 1. Conteo por categoría

183 valores de color: 174 hex (166 de 6 dígitos y 8 de 3 dígitos) y 9 `rgba`. No hay degradados ni
`color-mix`. Hay 5 `boxShadow`: dos usan `theme.emphasys.action.hoverTint` (ya es token) y tres
llevan `rgba` escrito a mano.

| Categoría | Total | Con token equivalente | Requiere token nuevo | Sin token (blanco / `rgba`) |
|---|---|---|---|---|
| Neutral estructural | 105 | 79 | 26 | — |
| Estado | 29 | 19 | 10 | — |
| Funcional (resumen financiero y retención) | 23 | 17 | 6 | — |
| Identidad (alfa del azul de marca en sombras) | 2 | — | — | 2 |
| Especial: foco/selección azul MUI `#1565c0` | 6 | — | 6 | — |
| Especial: separador dorado `#c8a25a` | 1 | — | 1 | — |
| Especial: blancos `#fff` / `#ffffff` | 10 | — | — | 10 |
| Especial: alfa blanco | 2 | — | — | 2 |
| Especial: alfa slate `rgba(148,163,184,…)` | 4 | — | — | 4 |
| Especial: sombra `rgba(15,23,42,0.12)` | 1 | — | — | 1 |
| Datos provenientes de BD | 0 | — | — | — |
| **Total** | **183** | **115** | **49** | **19** |

Ningún color de este archivo viene de la base de datos.

## 2. Archivos y líneas afectadas

Solo `frontend/src/pages/DocumentosFormPage.tsx`.

### 2.1 Neutral estructural con token existente (79)

| Token | Hex | Líneas |
|---|---|---|
| `neutralColors.gray[200]` | `#e5e7eb` | 4030, 4155, 7096, 7107, 7647, 8364, 8434, 8826, 8965 |
| `neutralColors.gray[400]` | `#9ca3af` | 4086, 8889 |
| `neutralColors.gray[500]` | `#6b7280` | 4090, 8893 |
| `neutralColors.gray[600]` | `#4b5563` | 5857, 5886 |
| `neutralColors.gray[700]` | `#374151` | 4184, 4205, 4949, 5304, 7465, 7857, 8656, 8677, 8703 |
| `neutralColors.gray[900]` | `#111827` | 4946, 5301, 7369, 7452, 7666, 7844 |
| `neutralColors.slate[50]` | `#f8fafc` | 7106, 7647, 8496, 8557 |
| `neutralColors.slate[100]` | `#f1f5f9` | 8524 |
| `neutralColors.slate[400]` | `#94a3b8` | 8569 |
| `neutralColors.slate[500]` | `#64748b` | 7648, 8373, 8443, 8542, 8622 |
| `neutralColors.slate[600]` | `#475569` | 7114, 8524 |
| `neutralColors.slate[700]` | `#334155` | 8545 |
| `neutralColors.slate[800]` | `#1e293b` | 8498, 8538 |
| `neutralColors.steel.line` | `#dbe3f0` | 8312 |
| `neutralColors.steel.panelBorder` | `#d9dde6` | 3912, 4571, 4689, 5203 |
| `neutralColors.steel.dividerSoft` | `#eef0f4` | 4260, 4297, 4700, 4721, 4888 |
| `neutralColors.steel.hover` | `#f0f2f6` | 4632 |
| `neutralColors.steel.hoverAlt` | `#eef1f8` | 4572, 5201 |
| `neutralColors.steel.dot` | `#a6adbd` | 4901, 5256 |
| `neutralColors.steel.label` | `#8b93a7` | 4261, 4298, 4683, 4740, 4760, 4821, 4843, 5239, 5485 |
| `neutralColors.steel.text` | `#5b6479` | 4279, 4374, 4573, 4631, 4749, 4764, 5200 |
| `neutralColors.steel.strong` | `#3d4557` | 3932, 4280 |

### 2.2 Neutral estructural que requiere token nuevo (26)

| Hex | Usos | Líneas | Rol observado | Propuesta |
|---|---|---|---|---|
| `#fafafa` | 4 | 4030, 4156, 8829, 8966 | Fondo de zona de adjuntos (gris MUI 50) | `steel.attachmentSurface` |
| `#f7f9fc` | 4 | 4582, 4886, 4898, 5205 | Fondo de fila expandida / hover | `steel.rowExpanded` |
| `#e2e5ec` | 4 | 4626, 4871, 5191, 5251 | Divisores del panel de partidas | `steel.dividerStrong` |
| `#0f1626` | 3 | 4749, 4776, 5156 | Texto fuerte (efecto neto, total de partida) | `steel.ink` |
| `#fafbfd` | 2 | 4700, 4870 | Fondo de pie de panel | `steel.footer` |
| `#eef1f4` | 2 | 4898, 5844 | Hover de fila / fondo | `steel.rowHover` |
| `#96a7c7` | 2 | 7336, 7762 | Borde de tarjeta de totales | `steel.totalsBorder` |
| `#fbfdff` | 2 | 8365, 8435 | Fondo de tarjetas de resumen | `steel.summarySurface` |
| `#e2e6ee` | 1 | 4582 | Borde de bloque de impuestos | `steel.taxBorder` |
| `#dde3ee` | 1 | 4587 | Divisor de impuestos | `steel.taxDivider` |
| `#f4f6f9` | 1 | 4886 | Franja alterna de partidas | `steel.rowStripe` |

> `#f7f9fc` coincide con `classicTokens.content.hover` y `#eef1f4` con `classicTokens.canvas.page`. **No** deben
> mapearse a esos roles: en las rutas experimentales valen otra cosa (beige) y la apariencia cambiaría.

### 2.3 Estado (29)

| Uso | Líneas | Valores | Token |
|---|---|---|---|
| Chip "fiscal completo / incompleto" | 4309, 4310 | `#e8f4ee` / `#1c6b47` · `#fdf3e3` / `#9a5b00` | **Nuevo** `fiscalStatusColors` (verde y ámbar propios, no Tailwind) |
| Indicador de imagen de partida (con imagen / archivo de producto / sin imagen) | 5183, 5518, 8112–8115 | `#2e7d32` · `#1565c0` · `#6b7280` | `feedbackTokens.success.main` + **nuevo** `attachmentIndicatorColors.productFile` + `neutralColors.gray[500]` |
| Estado de recepción (abierta / parcial / cerrada) | 8505–8507 | slate 100/600 · warning 100/800 · success 100/800 | `neutralColors.slate` + `alertColors.warning` + `alertColors.success` |
| Recibido / pendiente | 8549, 8552, 8560, 8561 | `#166534` · `#92400e` · `#94a3b8` | `alertColors.success[800]`, `alertColors.warning[800]`, `neutralColors.slate[400]` |
| Caja de anticipos registrados | 6030, 6031 | `#9db4ff` / `#d7deed` / `#f7faff` | **Nuevo** `selectionColors.advanceBorder` / `advanceBorderIdle` / `advanceSurface` |

### 2.4 Funcional: importes del resumen financiero (23)

El arreglo de tonos del resumen aparece **3 veces casi idéntico** (8347–8355, 8417–8425 y 8600–8609; el
tercero junta los dos descuentos en uno solo, con el naranja del descuento global):

| Concepto | Hex | Token |
|---|---|---|
| Subtotal bruto | `#334155` | `neutralColors.slate[700]` |
| Desc. partidas (negativo) | `#b45309` | `alertColors.warning[700]` |
| Desc. global (negativo) | `#9a3412` | `alertColors.caution[800]` |
| Subtotal neto | `#1d4ed8` | `alertColors.info[700]` |
| IVA trasladado | `#0f766e` | **Nuevo** (teal; hoy solo coincide con un avatar categórico) |
| Retenciones (negativo) | `#b45309` | `alertColors.warning[700]` |
| Total | `#111827` | `neutralColors.gray[900]` |

Además, "Retención" en el panel de impuestos (4769, 4770, 5490) usa **`#9a5b00`**, un ámbar propio distinto
del `#b45309` de las retenciones del resumen.

Propuesta: un token **`documentSummaryTones`** (gross, partDiscount, globalDiscount, net, tax, withholding,
total) que referencie los tokens anteriores y defina solo `tax` como valor nuevo. `#9a5b00` va como
`documentSummaryTones.withholdingInline` para no cambiar su valor.

### 2.5 Importes negativos, saldos a cargo, alertas, PDF, fondos, bordes y hover

- **Importes negativos:** descuentos y retenciones del resumen se pintan en ámbar (`#b45309`) o naranja
  (`#9a3412`), no en rojo. La retención del panel de impuestos usa `#9a5b00`. Un total menor que los anticipos
  usa `'error.main'` de MUI (6047). Son **tres tonos distintos para importes negativos** dentro del mismo archivo;
  unificarlos cambiaría la apariencia y entra en la decisión pendiente de "fuentes de signo".
- **Saldos a cargo:** no hay. El saldo disponible usa `tokens.metric.available/applied` (6828), que ya son tokens.
- **Alertas:** eliminar partida usa `color="error"` de MUI (5211, 5533, 8134, 8153) y `'error.main'` (8297). Ya son tokens.
- **Botones PDF:** no hay color de PDF en este archivo (14 menciones de "pdf", ninguna con color).
- **Fondos:** `#fafafa`, `#fafbfd`, `#fbfdff`, `#f7f9fc`, `#f7faff`, `#f8fafc`, más los blancos.
- **Bordes:** `#e5e7eb`, `#d9dde6`, `#e2e5ec`, `#e2e6ee`, `#96a7c7`, `#dbe3f0`, `#9db4ff`/`#d7deed`, punteado `#9ca3af`.
- **Hover:** `#eef1f4`, `#f7f9fc`, `#f0f2f6`, `#eef1f8` y el foco `#1565c0` de la zona de adjuntos.

### 2.6 Casos especiales (24)

| Valor | Líneas | Comentario |
|---|---|---|
| `#1565c0` (foco y selección) | 4092 ×2, 4155, 8895 ×2, 8965 | Azul 800 de MUI en la zona de adjuntos; propuesta `selectionColors.attachmentFocus` |
| `#c8a25a` | 5147 | Punto separador dorado; decorativo, propuesta `moduleAccents.separatorDot` |
| `#fff` / `#ffffff` | 3932, 3933, 4290, 4651, 4723, 4886, 5231, 5572, 7337, 7763 | Blanco; mismo criterio que los bloques previos: fuera |
| `rgba(255,255,255,0.7)`, `rgba(255,255,255,0.96)` | 4287, 8591 | Texto sobre banda primaria y fondo flotante |
| `rgba(29,47,104,0.06)` | 7338, 7764 | Sombra con el azul de marca en alfa (**identidad**) |
| `rgba(148,163,184,…)` | 8487, 8496, 8557, 8590 | Slate 400 con alfa en bordes |
| `rgba(15,23,42,0.12)` | 8593 | Sombra flotante |

> **Duplicado:** las secciones A (3900–4250) y G (8721–9039) son **dos copias** del mismo componente de adjuntos
> (dropzone, tarjeta seleccionada, diálogo). Conviene migrarlas juntas para que no diverjan.

## 3. Propuesta de migración en subbloques pequeños y reversibles

Cada subbloque es un commit con su fixture por línea en la cadena `LATER_FIXTURES`
(`theme/__fixtures__/colorMigrations.ts`). Así es reversible de forma individual y verificable contra el HEAD previo.

| # | Subbloque | Líneas | Literales | Tokens nuevos | Riesgo |
|---|---|---|---|---|---|
| **1** | Neutrales con token existente: encabezado, adjuntos ×2 y diálogos (A + G) | 3912–4250, 8721–9039 | 12 | 0 | Bajo |
| 2 | Neutrales con token existente: panel de captura (B) | 4251–4880 | 22 | 0 | Bajo |
| 3 | Neutrales con token existente: partidas (C) | 4881–5600 | 12 | 0 | Bajo |
| 4 | Neutrales con token existente: anticipos, totales y recepción (D, F) | 5601–8720 | 33 | 0 | Bajo |
| 5 | Neutrales nuevos (11 roles `steel`) | varias | 26 | 11 | Medio: nombres de rol |
| 6 | Estados: chip fiscal, indicador de imagen, recepción, anticipos | 4309–4310, 5183, 5518, 6030–6031, 8112–8115, 8505–8561 | 29 | 3 grupos | Medio |
| 7 | Resumen financiero: `documentSummaryTones` + retención | 4769–4770, 5490, 8347–8609 | 23 | 1 grupo | Medio: dedupe de 3 arreglos |
| 8 | Especiales: foco de adjuntos, separador dorado y alfa de marca | ver 2.6 | 9 | 2–3 | Medio: `rgba` de marca exige plantilla exacta |
| — | Fuera: blancos, alfa blanco, alfa slate y sombra | ver 2.6 | 19 | — | — |

Notas:

- **Subbloques 1 a 4:** usan solo tokens que ya existen. Aplican la misma herramienta y el mismo método ya probados (cambio por línea, autoverificación, equivalencia contra HEAD).
- **Subbloque 7:** puede hacerse en dos pasos.
  - 7a: tokenizar los tonos sin cambiar la estructura.
  - 7b, opcional: unificar los 3 arreglos en una sola fuente. Cambia código, no color, y necesita prueba de valores.
- **Tono de importes negativos:** el subbloque 7 **conserva los tres tonos actuales**. Unificarlos queda para la decisión de fuentes de signo.

## 4. Riesgos

### Regresión visual
1. **Usar roles del tema en lugar de constantes:** `#f7f9fc`, `#eef1f4`, `#e5e7eb` o `#111827` parecen
   `content.hover`, `canvas.page`, `content.border` o `content.foreground` del tema clásico. Mapearlos a esos roles
   cambiaría las rutas experimentales (factura, cotización, compras…). Solo deben usarse constantes de
   `neutralColors`.
2. **Mismo hex con dos significados:** `#9a5b00` es retención y también chip fiscal incompleto; `#1565c0` es
   foco de adjuntos y también "producto con archivo"; `#b45309` es descuento de partidas y también retenciones.
   Un reemplazo global los fusionaría.
3. **Arreglos de tonos casi duplicados:** el tercer arreglo junta los descuentos con el naranja del descuento global.
   Unificar sin cuidado cambiaría el color de esa línea.
4. **`rgba` de marca:** la versión con alfa del azul de marca no se puede derivar de `activeBrand` sin convertir hex a
   rgb. Cambiar el formato del string (`rgba(29, 47, 104, 0.06)`) rompería la equivalencia byte a byte.
5. **Blancos y `rgba`:** se dejan literales; deben quedar como excepción explícita en la prueba.

### Conflictos con `main`
- Hoy **no hay divergencia** en este archivo: el merge-base es `2b49072` (2026-10-15) y ni `main` ni la rama lo han tocado desde entonces.
- Es uno de los archivos que más cambian: **13 commits en `main` en 90 días**, el último `847f1fc` del 2026-10-14.
- Los fixtures por línea guardan números de línea y texto. Cualquier cambio de `main` en el archivo invalida el
  fixture del subbloque afectado: hay que integrar `main` (sin conflictos) y regenerar el fixture desde el nuevo HEAD.
- Mitigación:
  - subbloques pequeños, cada uno con su commit;
  - sincronizar con `main` antes de cada subbloque;
  - no mezclar estos cambios con cambios funcionales.
- `neutralColors.test.ts` exige hoy que `pages/DocumentosFormPage.tsx` **no** esté en ningún fixture neutral. El
  subbloque 1 debe reemplazar esa exclusión por la cobertura del nuevo fixture.

## 5. Pruebas necesarias para demostrar equivalencia visual

Por cada subbloque, con la infraestructura existente (`node --test`):

1. **Equivalencia contra HEAD:** revertir el subbloque (y los posteriores de la cadena) reproduce el SHA-256 del archivo previo.
2. **Transformación:** recalcular cada línea migrada desde su original con los valores actuales de la paleta da exactamente el texto migrado.
3. **Mutación:** alterar cualquier valor usado rompe la prueba 2. Además, una mutación real en `structural.ts` o `functional.ts`.
4. **Literales conservados:** el conteo de cada hex restante en el archivo coincide con las exclusiones documentadas (blancos, `rgba`, subbloques pendientes).
5. **Separación de significados:** para valores con doble significado (`#9a5b00`, `#1565c0`, `#b45309`), que cada línea use el token de su grupo.
6. **Paridad global:** los fixtures de tokens y del tema MUI siguen byte a byte iguales.
7. `tsc --noEmit` (213 errores preexistentes, 0 nuevos), `npm run build` y `git diff --check`.

Opcional, como revisión humana: abrir `/ventas/factura/nuevo` (tema experimental) y un código con tema clásico
antes y después del subbloque. Requiere backend local; no reemplaza las pruebas 1 a 3.

## 6. Recomendación del primer subbloque

**Subbloque 1: neutrales con token existente en el encabezado, las dos copias del componente de adjuntos y los diálogos**
(rangos A y G, **12 literales**, **0 tokens nuevos**).

- Solo usa tokens ya probados (`neutralColors.gray`, `steel.panelBorder`, `steel.strong`).
- Toca las dos copias del componente de adjuntos a la vez, para que no diverjan.
- Deja fuera, sin tocar, el foco `#1565c0`, `#fafafa` y los blancos de esas mismas líneas. Pasan al subbloque 5 u 8.
- Establece en este archivo el fixture por línea y la integración con `LATER_FIXTURES`, sobre el cambio más pequeño posible.

## 7. Estado de los subbloques

| # | Estado | Fixture | Detalle |
|---|---|---|---|
| 1 | **Aplicado** | `frontend/src/theme/__fixtures__/documentosForm.s1.baseline.json` | 12 literales en 12 líneas (3912, 3932, 4030, 4086, 4090, 4155, 4184, 4205, 8826, 8889, 8893, 8965) → `neutralColors.gray[200/400/500/700]`, `steel.panelBorder`, `steel.strong`. En esas mismas líneas quedan literales `#1565c0` (×2), `#fafafa` y `#fff`. Pendientes de los mismos hex en otros subbloques: `#e5e7eb` ×5, `#374151` ×7, `#6b7280` ×3, `#d9dde6` ×3, `#3d4557` ×1. |
| 2 | **Aplicado** | `frontend/src/theme/__fixtures__/documentosForm.s2.baseline.json` | 22 literales en 22 líneas del panel de captura (4261–4844, numeración posterior al subbloque 1) → `neutralColors.steel` (`label`, `text`, `strong`, `dividerSoft`, `panelBorder`, `hover`, `hoverAlt`). En esas líneas quedan `#fafbfd` y `#0f1626` (subbloque 5). En el mismo rango no se tocaron el chip fiscal (subbloque 6) ni la retención `#9a5b00` (subbloque 7). Sin imports nuevos. |
| 3 | **Aplicado** | `frontend/src/theme/__fixtures__/documentosForm.s3.baseline.json` | 12 literales en 12 líneas de partidas (escritorio y móvil: divisor de fila, numeración, nombre y descripción del producto, botón de detalle, "Agregar partida", "Impuestos") → `neutralColors.gray[700/900]` y `steel` (`dividerSoft`, `dot`, `text`, `hoverAlt`, `panelBorder`, `label`). Se excluyó el indicador de imagen (5184, 5519), que es estado (subbloque 6). Sin imports nuevos. |
| 4 | **Aplicado** | `frontend/src/theme/__fixtures__/documentosForm.s4.baseline.json` | 33 literales en 31 líneas de anticipos, relaciones, totales, resumen y recepción (5858–8704) → `neutralColors.gray[200/600/700/900]`, `slate[50/100/400/500/600/700/800]` y `steel.line`. Se excluyeron 9 líneas: los tonos del resumen financiero (subbloque 7) y el estado de recepción "abierta", "recibido = 0" y el indicador de imagen (subbloque 6). Sin imports nuevos. **Con esto terminan los neutrales que ya tenían token.** |
| 5 | **Aplicado** | `frontend/src/theme/__fixtures__/documentosForm.s5.baseline.json` | 26 literales en 23 líneas → 11 roles nuevos en `neutralColors.steel` (`structural.ts`): `ink`, `attachmentSurface`, `softSurface`, `wash`, `panelBand`, `rowStripe`, `dividerStrong`, `taxBorder`, `taxDivider`, `totalsBorder`, `summarySurface`. Por su uso real, dos nombres cambian respecto de §2.2: `#eef1f4` es `wash` (hover de fila y barra fija de encabezado) y `#fafbfd` es `panelBand` (pie del panel de captura y encabezado de partidas). Ninguno de los 11 valores queda literal. |
| 6–8 | Pendientes | — | Ver §3. Cada uno se agrega a `DOCUMENTOS_FORM_ORDER` en `colorMigrations.ts`. Los números de línea de §2 corresponden al HEAD `90e6063`; el subbloque 1 los desplaza una línea por su import. |

Pruebas del subbloque: `frontend/src/theme/documentosFormColors.test.ts`. Comprueba:
- equivalencia por SHA-256 contra el HEAD previo, revirtiendo antes los subbloques posteriores;
- que cada línea migrada se recalcula igual con los valores actuales de `neutralColors`;
- mutación de cada neutral usado;
- conteo exacto de los literales pendientes;
- exclusiones de las mismas líneas.

`neutralColors.test.ts` ya no trata `DocumentosFormPage` como excluido: exige que no esté en los bloques neutrales y que tenga subbloques propios.
