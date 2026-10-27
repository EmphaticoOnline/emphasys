-- Tipos de documento para cancelar un saldo a favor que no se quiere seguir
-- arrastrando: lo que quedó "por aplicar" en un pago (cobrado o pagado de más)
-- o el disponible de una nota de crédito.
--
-- Son de naturaleza CARGO: reciben la aplicación del pago o de la nota de
-- crédito (origen = pago/NC, destino = este documento). Las vistas
-- documentos_saldo / documentos_saldo_operativo calculan el saldo por
-- naturaleza, así que no requieren cambios.
--
-- Sólo da de alta el catálogo global. No se habilitan en
-- core.empresas_tipos_documento: no deben aparecer como pestaña propia; se
-- crean desde los workspaces de Pagos y Notas de crédito.
-- Sin pólizas contables automáticas por ahora.
--
-- Idempotente.

BEGIN;

INSERT INTO core.tipos_documento (codigo, nombre, nombre_plural, icono, orden, activo, modulo, naturaleza_saldo, afecta_inventario)
SELECT 'ajuste_favor_cliente', 'Cancelación de saldo a favor', 'Cancelaciones de saldo a favor', 'Balance', 9, true, 'ventas', 'cargo', NULL
 WHERE NOT EXISTS (SELECT 1 FROM core.tipos_documento WHERE codigo = 'ajuste_favor_cliente');

INSERT INTO core.tipos_documento (codigo, nombre, nombre_plural, icono, orden, activo, modulo, naturaleza_saldo, afecta_inventario)
SELECT 'ajuste_favor_proveedor', 'Cancelación de saldo a favor', 'Cancelaciones de saldo a favor', 'Balance', 12, true, 'compras', 'cargo', NULL
 WHERE NOT EXISTS (SELECT 1 FROM core.tipos_documento WHERE codigo = 'ajuste_favor_proveedor');

COMMIT;
