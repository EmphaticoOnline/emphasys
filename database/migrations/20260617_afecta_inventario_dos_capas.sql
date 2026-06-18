BEGIN;

-- =========================================================
-- Capa 1: defaults semánticos en el catálogo global
-- =========================================================

ALTER TABLE core.tipos_documento
ADD COLUMN IF NOT EXISTS afecta_inventario VARCHAR(20) NULL;

COMMENT ON COLUMN core.tipos_documento.afecta_inventario IS
'Comportamiento predeterminado de afectación de inventario para este tipo de documento.
 NULL significa que el tipo no tiene default definido (se resuelve como ''none'').
 Puede ser sobreescrito por empresa en core.empresas_tipos_documento.afecta_inventario.';

-- Defaults semánticos de Emphasys:
-- Documentos que representan entrada física de mercancía
UPDATE core.tipos_documento
SET afecta_inventario = 'entrada'
WHERE codigo IN ('factura_compra', 'nota_credito');

-- Documentos que representan salida física de mercancía
UPDATE core.tipos_documento
SET afecta_inventario = 'salida'
WHERE codigo IN ('factura', 'nota_credito_compra');

-- El resto (recepcion, orden_compra, cotizacion, pedido, remision,
-- pago_cliente, pago_proveedor, orden_servicio, etc.) queda en NULL
-- → COALESCE lo resuelve como 'none' en tiempo de ejecución.

-- =========================================================
-- Capa 2: override por empresa — hacer nullable
-- =========================================================

ALTER TABLE core.empresas_tipos_documento
ALTER COLUMN afecta_inventario DROP NOT NULL,
ALTER COLUMN afecta_inventario SET DEFAULT NULL;

-- Resetear valores 'none' que eran DEFAULT implícito, no decisión del usuario.
-- Después de este UPDATE, NULL = "usar default del catálogo".
-- Si el usuario configuró explícitamente 'none', también se resetea aquí
-- porque antes no había forma de distinguirlos. A partir de ahora sí.
UPDATE core.empresas_tipos_documento
SET afecta_inventario = NULL
WHERE afecta_inventario = 'none';

COMMIT;
