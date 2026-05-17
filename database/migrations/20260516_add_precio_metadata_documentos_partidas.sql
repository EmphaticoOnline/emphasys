-- =====================================================
-- Metadata de precios en partidas de documentos
-- Emphasys ERP
-- =====================================================

ALTER TABLE public.documentos_partidas
ADD COLUMN IF NOT EXISTS precio_lista_id BIGINT NULL;

ALTER TABLE public.documentos_partidas
ADD COLUMN IF NOT EXISTS precio_editado_manual BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.documentos_partidas
ADD COLUMN IF NOT EXISTS precio_origen VARCHAR(30) NULL;


COMMENT ON COLUMN public.documentos_partidas.precio_lista_id IS
'Lista de precios utilizada para resolver automáticamente el precio de la partida.';

COMMENT ON COLUMN public.documentos_partidas.precio_editado_manual IS
'Indica si el precio unitario fue modificado manualmente por el usuario después de ser sugerido por el sistema.';

COMMENT ON COLUMN public.documentos_partidas.precio_origen IS
'Origen del precio unitario. Ejemplos: LISTA, DEFAULT, MANUAL, LEGACY.';


CREATE INDEX IF NOT EXISTS idx_documentos_partidas_precio_lista
ON public.documentos_partidas (precio_lista_id);

CREATE INDEX IF NOT EXISTS idx_documentos_partidas_precio_editado_manual
ON public.documentos_partidas (precio_editado_manual);


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'documentos_partidas'
          AND constraint_name = 'fk_documentos_partidas_precio_lista'
    ) THEN
        ALTER TABLE public.documentos_partidas
        ADD CONSTRAINT fk_documentos_partidas_precio_lista
        FOREIGN KEY (precio_lista_id)
        REFERENCES public.precios_listas(id);
    END IF;
END $$;