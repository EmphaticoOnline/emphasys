-- PE-47: referencia opcional a la imagen predeterminada de una plantilla local.
-- No se ejecuta automáticamente; debe aplicarse mediante el proceso de migraciones.
ALTER TABLE whatsapp.plantillas
  ADD COLUMN IF NOT EXISTS imagen_url text;

COMMENT ON COLUMN whatsapp.plantillas.imagen_url IS
  'URL pública opcional de la imagen predeterminada administrada localmente por Emphasys.';
