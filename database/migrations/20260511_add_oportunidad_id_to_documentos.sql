ALTER TABLE public.documentos
    ADD COLUMN IF NOT EXISTS oportunidad_id integer NULL;

CREATE INDEX IF NOT EXISTS idx_documentos_oportunidad_id
    ON public.documentos USING btree (oportunidad_id);

UPDATE public.documentos d
SET oportunidad_id = o.id
FROM crm.oportunidades_venta o
WHERE o.cotizacion_principal_id = d.id
  AND o.empresa_id = d.empresa_id
  AND LOWER(d.tipo_documento) = 'cotizacion'
  AND d.oportunidad_id IS NULL;