-- LIMPIEZA EXCLUSIVA DEL ESCENARIO DE PRUEBA - NO EJECUTAR SIN REVISIÓN.
-- Borra relaciones/importaciones/movimientos de prueba y operaciones TEST-CONC-*.
-- No toca otros datos ni modifica saldos manualmente.

BEGIN;

DELETE FROM public.finanzas_estados_cuenta_importados_relaciones r
USING public.finanzas_estados_cuenta_importados_movimientos m,
      public.finanzas_estados_cuenta_importados i
WHERE r.movimiento_bancario_id = m.id
  AND m.importacion_id = i.id
  AND i.empresa_id = 8
  AND i.cuenta_id = 10
  AND (m.referencia_bancaria LIKE 'TEST-BANK-%' OR i.nombre_original LIKE 'estado-cuenta-conciliacion-test%');

DELETE FROM public.finanzas_estados_cuenta_importados_movimientos
WHERE empresa_id = 8
  AND cuenta_id = 10
  AND (referencia_bancaria LIKE 'TEST-BANK-%'
       OR importacion_id IN (
         SELECT id FROM public.finanzas_estados_cuenta_importados
         WHERE empresa_id = 8 AND cuenta_id = 10
           AND nombre_original LIKE 'estado-cuenta-conciliacion-test%'
       ));

DELETE FROM public.finanzas_estados_cuenta_importados
WHERE empresa_id = 8
  AND cuenta_id = 10
  AND nombre_original LIKE 'estado-cuenta-conciliacion-test%';

DELETE FROM public.finanzas_operaciones
WHERE empresa_id = 8
  AND cuenta_id = 10
  AND referencia LIKE 'TEST-CONC-%';

COMMIT;
