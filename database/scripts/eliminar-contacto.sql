BEGIN;

-- Ajusta empresa_id y teléfonos (incluye normalizados E.164)
-- Empresa
--  :empresa_id := 1
-- Teléfonos
--  :tels := ('3331412955','3331412954','3336674118','523312889584','523327448637')

CREATE TEMP TABLE tmp_contactos ON COMMIT DROP AS
SELECT id, telefono
FROM public.contactos
WHERE empresa_id = 1
  AND telefono IN ('3331412955','3331412954','3336674118','523312889584','523327448637');

CREATE TEMP TABLE tmp_conv ON COMMIT DROP AS
SELECT id
FROM whatsapp.conversaciones
WHERE contacto_id IN (SELECT id FROM tmp_contactos);

-- 1) Mensajes
DELETE FROM whatsapp.mensajes
 WHERE conversacion_id IN (SELECT id FROM tmp_conv)
    OR contacto_id    IN (SELECT id FROM tmp_contactos);

-- 2) Conversaciones
DELETE FROM whatsapp.conversaciones
 WHERE id IN (SELECT id FROM tmp_conv);

-- 3) Mapeo y estado por teléfono
DELETE FROM whatsapp.contacto_mapeo
 WHERE contacto_id     IN (SELECT id FROM tmp_contactos)
    OR numero_telefono IN ('3331412955','3331412954','3336674118','523312889584','523327448637');

DELETE FROM whatsapp.contacto_estado
 WHERE empresa_id = 1
   AND telefono  IN ('3331412955','3331412954','3336674118','523312889584','523327448637');

-- 4) Auxiliares del contacto y el contacto
DELETE FROM public.contactos_domicilios
 WHERE contacto_id IN (SELECT id FROM tmp_contactos);

DELETE FROM public.contactos_datos_fiscales
 WHERE contacto_id IN (SELECT id FROM tmp_contactos);

DELETE FROM public.contactos
 WHERE id IN (SELECT id FROM tmp_contactos);

COMMIT;