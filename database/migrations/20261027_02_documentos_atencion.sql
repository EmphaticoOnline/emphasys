-- database/migrations/20261027_02_documentos_atencion.sql
-- Persona a la que va dirigido el documento (campo "Atención"), capturada por documento.
-- Se guarda solo el texto para conservar el nombre tal como se emitió.

ALTER TABLE public.documentos
    ADD COLUMN IF NOT EXISTS atencion character varying(150);

COMMENT ON COLUMN public.documentos.atencion IS 'Persona a la que va dirigido el documento (Atención). Texto libre; se imprime en el PDF.';

-- Las cotizaciones ya imprimían "Atención" con contactos.nombre_contacto; se conserva
-- ese valor para que su reimpresión no cambie. El resto de tipos no lo imprimía.
UPDATE public.documentos d
   SET atencion = LEFT(TRIM(c.nombre_contacto), 150)
  FROM public.contactos c
 WHERE c.id = d.contacto_principal_id
   AND c.empresa_id = d.empresa_id
   AND LOWER(d.tipo_documento) = 'cotizacion'
   AND d.atencion IS NULL
   AND NULLIF(TRIM(c.nombre_contacto), '') IS NOT NULL;
