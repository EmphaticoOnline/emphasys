-- =========================================================
-- SCRIPT:
-- 20260719_contabilidad_polizas_detalle_concepto_texto.sql
--
-- contabilidad.polizas_detalle solo tenía concepto_id (FK al catálogo
-- genérico public.conceptos), sin lugar para una descripción específica
-- de ese renglón. El motor de contabilización automática (factura de
-- venta, fase 1) necesita dejar un concepto explícito por línea (ej.
-- "Factura FAC-065 - Cliente ..."), que no encaja en un catálogo de
-- conceptos genéricos. Se agrega una columna de texto libre, opcional,
-- que convive con concepto_id sin reemplazarlo.
-- =========================================================

BEGIN;

ALTER TABLE contabilidad.polizas_detalle
ADD COLUMN concepto_texto varchar(200) NULL;

COMMENT ON COLUMN contabilidad.polizas_detalle.concepto_texto IS
'Concepto descriptivo libre del renglón, generado por procesos de contabilización automática (ej. factura de venta) o capturado manualmente. Independiente de concepto_id (catálogo genérico de public.conceptos).';

COMMIT;
