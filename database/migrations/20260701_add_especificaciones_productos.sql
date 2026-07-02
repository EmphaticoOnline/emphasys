-- =====================================================
-- Especificaciones de producto (texto enriquecido)
-- Emphasys ERP
-- =====================================================
-- Se almacena como HTML sanitizado (negritas, cursivas, listas,
-- párrafos) generado por el editor de texto enriquecido del
-- formulario de productos. La sanitización se aplica en backend
-- antes de guardar.

ALTER TABLE public.productos
ADD COLUMN IF NOT EXISTS especificaciones TEXT;

COMMENT ON COLUMN public.productos.especificaciones IS
'Especificaciones comerciales/técnicas del producto en HTML sanitizado (negritas, cursivas, listas, párrafos).';
