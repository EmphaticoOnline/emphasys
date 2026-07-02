-- =====================================================
-- Descuento por monto fijo a nivel partida
-- Emphasys ERP
-- =====================================================
-- El campo existente documentos_partidas.descuento sigue representando
-- el descuento porcentual (compatibilidad con documentos existentes).
-- descuento_tipo indica cuál de los dos campos debe usarse:
--   'porcentaje' -> usa documentos_partidas.descuento
--   'monto'      -> usa documentos_partidas.descuento_monto

ALTER TABLE public.documentos_partidas
ADD COLUMN IF NOT EXISTS descuento_tipo VARCHAR(20) NOT NULL DEFAULT 'porcentaje';

ALTER TABLE public.documentos_partidas
ADD COLUMN IF NOT EXISTS descuento_monto NUMERIC(15,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.documentos_partidas.descuento_tipo IS
'Tipo de descuento aplicado a la partida: porcentaje (usa la columna descuento) o monto (usa la columna descuento_monto).';

COMMENT ON COLUMN public.documentos_partidas.descuento_monto IS
'Descuento fijo en importe aplicado a la partida cuando descuento_tipo = monto. No debe exceder cantidad * precio_unitario (validado en aplicación).';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'documentos_partidas'
          AND constraint_name = 'chk_documentos_partidas_descuento_tipo'
    ) THEN
        ALTER TABLE public.documentos_partidas
        ADD CONSTRAINT chk_documentos_partidas_descuento_tipo
        CHECK (descuento_tipo IN ('porcentaje', 'monto'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'documentos_partidas'
          AND constraint_name = 'chk_documentos_partidas_descuento_monto_no_negativo'
    ) THEN
        ALTER TABLE public.documentos_partidas
        ADD CONSTRAINT chk_documentos_partidas_descuento_monto_no_negativo
        CHECK (descuento_monto >= 0);
    END IF;
END $$;
