-- 20260612_extend_tratamiento_impuestos_length.sql

ALTER TABLE public.documentos
ALTER COLUMN tratamiento_impuestos TYPE varchar(30);

COMMENT ON COLUMN public.documentos.tratamiento_impuestos IS
'Define el tratamiento fiscal del documento. Valores esperados: normal, sin_iva, tasa_cero, exento, venta_publico_general, factura_global. Determina cómo se calculan los impuestos y el tratamiento fiscal/operativo del documento.';