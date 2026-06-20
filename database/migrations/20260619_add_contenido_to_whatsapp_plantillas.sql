ALTER TABLE whatsapp.plantillas
  ADD COLUMN IF NOT EXISTS contenido TEXT NULL;

COMMENT ON COLUMN whatsapp.plantillas.contenido
  IS 'Cuerpo del mensaje de la plantilla. Puede contener variables tipo {{1}}, {{2}}, etc. Se usa para mostrar vista previa y detectar variables al enviar desde el CRM.';
