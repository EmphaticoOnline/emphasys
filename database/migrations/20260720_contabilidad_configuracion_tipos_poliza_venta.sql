-- =========================================================
-- SCRIPT:
-- 20260720_contabilidad_configuracion_tipos_poliza_venta.sql
--
-- Configuración por empresa de qué tipo de póliza debe usar el motor de
-- contabilización automática de ventas, para dejar de preguntarlo en cada
-- operación (individual, lote o reversa por cancelación). Fase 1: solo
-- ventas (emisión y cancelación de factura de venta).
-- =========================================================

BEGIN;

ALTER TABLE contabilidad.configuracion
ADD COLUMN tipo_poliza_venta_factura_id bigint NULL REFERENCES contabilidad.tipos_poliza(id),
ADD COLUMN tipo_poliza_venta_cancelacion_id bigint NULL REFERENCES contabilidad.tipos_poliza(id);

COMMENT ON COLUMN contabilidad.configuracion.tipo_poliza_venta_factura_id IS
'Tipo de póliza que debe usar el motor de contabilización automática al contabilizar la emisión de una factura de venta (individual o en lote). NULL = no configurado; en ese caso no se genera póliza y se informa al usuario.';

COMMENT ON COLUMN contabilidad.configuracion.tipo_poliza_venta_cancelacion_id IS
'Tipo de póliza que debe usar el motor de contabilización automática al generar la reversa por cancelación de una factura de venta ya contabilizada. NULL = no configurado; en ese caso no se genera la reversa y se informa al usuario.';

COMMIT;
