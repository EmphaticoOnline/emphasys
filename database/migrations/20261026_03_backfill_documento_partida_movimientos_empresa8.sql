-- Rellena inventario.movimientos_partidas.documento_partida_id en la EMPRESA 8,
-- para los renglones creados mientras aplicar_movimiento no guardaba el enlace
-- (ver 20261026_02 y docs/analisis-enlace-partida-movimientos-inventario.md).
--
-- Sólo enlaza cuando no hay ambigüedad: el producto aparece una sola vez en el
-- movimiento y una sola vez en las partidas del documento del movimiento.
-- Conteo previo (solo lectura, 2026-10-26): 1,339 renglones documentales, todos
-- enlazables; 0 ambiguos. Los 112 renglones de movimientos manuales no tienen
-- documento y se quedan en NULL, que es lo correcto.
--
-- Sólo toca filas con documento_partida_id NULL. Idempotente.

BEGIN;

WITH candidatos AS (
  SELECT mp.id AS movimiento_partida_id,
         MIN(dp.id) AS documento_partida_id
    FROM inventario.movimientos_partidas mp
    JOIN inventario.movimientos m
      ON m.id = mp.movimiento_id
     AND m.empresa_id = mp.empresa_id
    JOIN public.documentos_partidas dp
      ON dp.documento_id = m.documento_id
     AND dp.producto_id = mp.producto_id
   WHERE mp.empresa_id = 8
     AND mp.documento_partida_id IS NULL
     AND m.documento_id IS NOT NULL
     AND (SELECT count(*) FROM inventario.movimientos_partidas mp2
           WHERE mp2.movimiento_id = mp.movimiento_id
             AND mp2.producto_id = mp.producto_id) = 1
   GROUP BY mp.id
  HAVING count(dp.id) = 1
)
UPDATE inventario.movimientos_partidas mp
   SET documento_partida_id = c.documento_partida_id
  FROM candidatos c
 WHERE mp.id = c.movimiento_partida_id
   AND mp.empresa_id = 8
   AND mp.documento_partida_id IS NULL;

COMMIT;
