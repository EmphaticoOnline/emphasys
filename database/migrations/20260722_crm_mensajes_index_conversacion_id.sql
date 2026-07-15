-- Indice de soporte para la busqueda de leads por contenido de mensajes (LeadsPage)
-- y para el LATERAL join que ya obtenia el ultimo mensaje de cada conversacion.
-- IMPORTANTE: CREATE INDEX CONCURRENTLY no puede ejecutarse dentro de una transaccion.
--
-- crm.mensajes no tenia ningun indice sobre conversacion_id. El nuevo filtro de
-- busqueda usa EXISTS (SELECT 1 FROM crm.mensajes WHERE conversacion_id = c.id
-- AND contenido ILIKE ...) una vez por cada conversacion visible para la
-- empresa/vendedor; sin indice, cada llamada obliga a un escaneo del rango de
-- mensajes de esa empresa (o de la tabla completa) en lugar de un lookup directo
-- por conversacion.
--
-- Validado localmente (base desechable, sin tocar produccion) con ~1.8M filas en
-- crm.mensajes y un "tenant" con 6000 conversaciones / ~600k mensajes:
--   - Sin este indice: la consulta no termino en 2 minutos (cancelada).
--   - Con este indice: 118-465 ms para el mismo escenario (peor caso muy por
--     encima del volumen esperado por empresa).
--
-- No se agrega un indice GIN/trgm sobre "contenido": al acotar primero por
-- conversacion_id (via este indice), el ILIKE solo recorre los mensajes de ESA
-- conversacion (decenas/centenas de filas), no la tabla completa, asi que un
-- trigram global no aporta beneficio adicional para este patron de acceso.

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_mensajes_conversacion_id
ON crm.mensajes (conversacion_id);
