# Análisis: los movimientos de inventario no guardan la partida del documento

Fecha del análisis: 2026-10-26. Estado: **corregido y aplicado en producción el 2026-10-26**:

- `database/migrations/20261026_02_aplicar_movimiento_guarda_documento_partida.sql`: la función vuelve a guardar el enlace.
- `database/migrations/20261026_03_backfill_documento_partida_movimientos_empresa8.sql`: rellena los enlaces solo en la empresa 8 (1,339 renglones, ninguno ambiguo).
- `resolverCostosDevolucionVenta` ya usa primero el enlace exacto por partida.

El resto del documento describe el problema original.

## Resumen

`inventario.movimientos_partidas.documento_partida_id` debería indicar qué partida del documento (factura, nota de crédito, recepción…) originó cada renglón del movimiento de inventario. Desde la reescritura del motor de inventario del 2026-10-09, **la función SQL `inventario.aplicar_movimiento` ya no guarda ese campo**, aunque el backend sí lo envía. Por eso no se puede ligar una partida de un documento con su renglón de inventario, y en particular no se puede saber **a qué costo salió una partida específica de una venta**.

## Evidencia

### 1. El backend sí manda el dato

`backend/src/modules/inventario/inventario.service.ts`, en `aplicarInventarioDesdeDocumentoEnTransaccion`, arma cada partida del payload con `documento_partida_id: p.documento_partida_id` y la envía como JSON a:

```sql
SELECT inventario.aplicar_movimiento($1, $2, $3::date, $4, $5, $6, $7::jsonb, $8)
```

### 2. La función SQL vigente lo descarta

Versión vigente: `database/migrations/20261010_001_correccion_transferencias_aplicar_movimiento.sql`, que corrige la de `20261009_inventario_negativos_y_costos.sql`. Sus `INSERT INTO inventario.movimientos_partidas(...)` (entrada, salida y transferencia) **no incluyen la columna `documento_partida_id`** ni leen `p->>'documento_partida_id'`.

La versión anterior, `database/migrations/20260618_crear_funcion_aplicar_movimiento.sql`, **sí lo hacía**: leía `v_doc_partida_id := (v_partida->>'documento_partida_id')::INTEGER` y lo insertaba. Es una **regresión** introducida en la reescritura del 2026-10-09.

### 3. Datos en producción (consulta de solo lectura, 2026-10-26)

| Empresa | Con partida | Movimiento documental | Renglones | Fechas |
|---|---|---|---|---|
| 2 | sí | sí | 13 | 2026-09-23 a 2026-09-27 (función anterior) |
| 8 | **no** | sí | 1,339 | 2026-10-14 a 2026-10-16 |
| 8 | no | no (manuales) | 112 | 2026-10-10 a 2026-10-16 |

Todos los movimientos documentales generados con la función vigente tienen `documento_partida_id = NULL`. Los de la empresa 8 vienen en gran parte del seed `backend/scripts/seed-demo-empresa-8.ts`, que también pasa por la función vigente.

## Impacto

1. **Costo de devoluciones de venta (lo que destapó el problema).** Al emitir una nota de crédito de venta por devolución, los productos entran al almacén y deben hacerlo al costo con el que salieron en la venta original. La nota de crédito sí sabe de qué partida de la factura viene (`documentos_partidas_vinculos.partida_origen_id`), pero no hay manera de llegar de esa partida al renglón de salida del inventario.
2. **Precisión cuando un producto aparece varias veces.** Si una factura vende el mismo producto en dos partidas con costos distintos, o la nota viene de varias facturas, hoy solo se puede promediar por producto.
3. **Trazabilidad general.** Kárdex, auditoría y cualquier reporte que quiera ir de un renglón de inventario a la partida del documento (o al revés) no tiene el enlace.
4. **Reversiones.** `revertirInventarioDocumentoEnTransaccion` copia `documento_partida_id` del movimiento original al de reversión. Hoy copia `NULL`; no falla, pero la reversión también queda sin enlace.

## Solución provisional ya implementada (no la sustituye)

En `inventario.service.ts`, la función `resolverCostosDevolucionVenta` toma el costo de entrada de una devolución de venta así:

1. Busca los documentos origen de la nota, combinando tres fuentes: `documentos_partidas_vinculos`, `documentos_relaciones` con `tipo_relacion = 'origen_nota_credito'` y el campo heredado `documentos.documento_origen_id`.
2. Toma los renglones de **salida** (`signo < 0`, no reversión) de los movimientos de esos documentos **para el mismo producto**, y calcula el promedio ponderado de `costo_unitario`.
3. Si no hay venta, usa el último `costo_promedio_resultante` del producto en el almacén.
4. Si tampoco hay, lanza `COSTO_DEVOLUCION_NO_DISPONIBLE` con un mensaje claro.

Limitación: es por **producto**, no por **partida**. Funciona bien en el caso común, pero no distingue dos partidas del mismo producto con costos distintos.

## Corrección solicitada

1. **Nueva migración** en `database/migrations/`, con el nombre `YYYYMMDD_NN_descripcion.sql` (fecha real del día y consecutivo). Debe hacer `CREATE OR REPLACE FUNCTION inventario.aplicar_movimiento(...)` partiendo de la versión vigente (`20261010_001_...`) y:
   - leer `nullif(p->>'documento_partida_id','')::integer` de cada partida del JSON;
   - incluirlo en los tres `INSERT INTO inventario.movimientos_partidas` (entrada, salida y salida de transferencia; la entrada de transferencia se genera dentro de la función y debe heredar el de su salida si aplica);
   - no cambiar nada más de la lógica de costos, negativos ni transferencias.
2. **Backfill opcional** de los renglones existentes con `documento_partida_id IS NULL`, solo cuando el emparejamiento no sea ambiguo:
   - se empareja por `m.documento_id = dp.documento_id` y `mp.producto_id = dp.producto_id`;
   - solo se llena cuando el producto aparece **una sola vez** en el documento y una sola vez en el movimiento;
   - los casos ambiguos se dejan en `NULL` y se reportan.

   **Requiere autorización explícita antes de correrlo, porque escribe en producción.**
3. **Usar el enlace en el costo de la devolución.** En `resolverCostosDevolucionVenta`, preferir el camino exacto: partida de la nota → `documentos_partidas_vinculos.partida_origen_id` → `inventario.movimientos_partidas.documento_partida_id` → `costo_unitario`. Conservar el promedio por producto actual solo como respaldo para movimientos sin enlace.
4. **Pruebas:**
   - emitir una factura con el mismo producto en dos partidas con costos distintos, devolver una sola de ellas y verificar que la entrada usa el costo de esa partida;
   - verificar que una reversión hereda el enlace;
   - verificar que las transferencias siguen funcionando.

## Archivos relevantes

- `database/migrations/20260618_crear_funcion_aplicar_movimiento.sql`: versión que sí guardaba el enlace.
- `database/migrations/20261009_inventario_negativos_y_costos.sql` y `20261010_001_correccion_transferencias_aplicar_movimiento.sql`: versiones sin enlace (la vigente es la segunda).
- `backend/src/modules/inventario/inventario.service.ts`: `aplicarInventarioDesdeDocumentoEnTransaccion`, `resolverCostosDevolucionVenta` y `revertirInventarioDocumentoEnTransaccion`.
- `backend/src/modules/documentos/documentos.service.ts`: `aplicarInventarioPostEmision` y `mensajeErrorInventario`.
