-- Procedimiento controlado para reiniciar únicamente el inventario de empresa 8.
-- NO ejecutar automáticamente. Requiere autorización explícita y respaldo.
-- Primero revisar las consultas de dependencias; las filas documentales no se eliminan
-- hasta decidir cómo preservar o desasociar su trazabilidad.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Diagnóstico previo (ejecutar por separado con npm run db:query):
-- SELECT COUNT(*) FROM inventario.movimientos WHERE empresa_id=8;
-- SELECT COUNT(*) FROM inventario.movimientos_partidas WHERE empresa_id=8;
-- SELECT COUNT(*) FROM inventario.movimientos WHERE empresa_id=8 AND documento_id IS NOT NULL;
-- SELECT documento_id, COUNT(*) FROM inventario.movimientos WHERE empresa_id=8 AND documento_id IS NOT NULL GROUP BY documento_id;

-- Paso destructivo, habilitar manualmente sólo después de revisar dependencias:
-- DELETE FROM inventario.movimientos_partidas WHERE empresa_id=8;
-- DELETE FROM inventario.movimientos WHERE empresa_id=8;
-- DELETE FROM inventario.existencias WHERE empresa_id=8;

ROLLBACK;
