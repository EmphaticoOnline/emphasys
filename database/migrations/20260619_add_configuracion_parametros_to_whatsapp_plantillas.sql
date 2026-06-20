ALTER TABLE whatsapp.plantillas
  ADD COLUMN IF NOT EXISTS configuracion_parametros JSONB NULL;

COMMENT ON COLUMN whatsapp.plantillas.configuracion_parametros
  IS 'Configuración de variables de la plantilla. Array JSON con estructura: [{variable: number, label: string, origen: "manual"|"contacto.nombre"|"contacto.telefono"|"contacto.empresa"}]. NULL = todas las variables son manuales.';
