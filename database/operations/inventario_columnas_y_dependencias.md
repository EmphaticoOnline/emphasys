# Inventario: columnas y dependencias del motor de recálculo

## Columnas almacenadas originales

- `inventario.movimientos`: empresa, fecha, tipo, estatus de afectación y referencias comerciales.
- `inventario.movimientos_partidas`: producto, almacén, almacén destino, cantidad, signo, tipo de partida y costo unitario capturado.

## Columnas derivadas

- `movimientos_partidas.existencia_resultante`
- `movimientos_partidas.valor_movimiento`
- `movimientos_partidas.costo_promedio_resultante`
- `movimientos_partidas.secuencia_operativa`
- `inventario.existencias.existencia` como caché por producto-almacén.

`inventario.existencias` no almacena costo ni valor monetario.

## Dependencias verificadas

- La reconstrucción es invocada por afectación, desafectación, correcciones de transferencias y el recálculo administrativo.
- Las transferencias se representan con dos partidas vinculadas por `movimiento_id`: `salida_transferencia` y `entrada_transferencia`.
- `existencias` tiene unicidad `(empresa_id, producto_id, almacen_id)`.
- Las cantidades originales no deben sobrescribirse durante la reconstrucción.
