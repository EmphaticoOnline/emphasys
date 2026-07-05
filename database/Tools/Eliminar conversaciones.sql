-- Cambia estos valores
-- Ejemplo: 'Antonio', 'Fabi', 'Fabiola', etc.

SELECT
  c.id AS conversacion_id,
  c.empresa_id,
  c.contacto_id,
  co.nombre AS contacto,
  c.ultimo_mensaje_en ,
  c.creada_en 
FROM crm.conversaciones c
JOIN public.contactos co ON co.id = c.contacto_id
WHERE co.nombre ILIKE '%JORGE DIAZ%'
ORDER BY c.ultimo_mensaje_en DESC NULLS LAST, c.creada_en DESC;


-- Eliminar mensajes y conversación
BEGIN;

-- Cambia este ID
DELETE FROM crm.mensajes
WHERE conversacion_id = 60;

DELETE FROM crm.conversaciones
WHERE id = 60;

COMMIT;