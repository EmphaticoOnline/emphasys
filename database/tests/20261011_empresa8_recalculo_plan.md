# Plan de ejecución de pruebas del recálculo — empresa 8

El script SQL `20261011_empresa8_recalculo_funcional.sql` debe ejecutarse únicamente en una copia aislada de la base. Cada escenario termina en `ROLLBACK`.

El caso 8 requiere dos sesiones HTTP/backend:

1. Ejecutar `POST /api/inventario/recalculos/analizar` para el producto `6213`.
2. Conservar el campo `revision` de la respuesta.
3. Registrar un movimiento ficticio en la misma base de pruebas desde la segunda sesión.
4. Ejecutar `POST /api/inventario/recalculos/ejecutar` enviando la `revision` anterior.
5. Esperar HTTP `409`, código `RECALCULO_OBSOLETO` y ningún cambio persistente.

Resultados esperados principales:

| Caso | Resultado esperado |
|---|---|
| Entrada diferente | Almacén 40: 150 unidades, valor 27,000, costo 180 |
| Salida normal | Almacén 40: 70 unidades, valor 8,400, costo 120 |
| Entrada retroactiva | Almacén 40: 200 unidades, valor 19,200, costo 96; almacén 41: costo 96 |
| Transferencia a 42 | Almacén 40: 80; almacén 42: 20; costo transferido 120 |
| Desafectado | No altera existencias ni derivados |
| Diferencia solo costo | Corrige valor/costo sin alterar cantidad |
| Diferencia solo existencia | Restituye existencia calculada desde partidas |
| Obsoleto | HTTP 409 y rechazo de ejecución |
| Idempotencia | Segunda reconstrucción produce los mismos resultados |
| Existencia insuficiente | Error `EXISTENCIA_INSUFICIENTE` y rollback completo |
