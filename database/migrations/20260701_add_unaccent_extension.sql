-- Habilita la funcion unaccent() usada por la busqueda de Contactos
-- (nombre, nombre_contacto, vendedor, clasificacion, origen, interes_inicial, observaciones)
-- para que coincidencias sin acentos encuentren texto con acentos y viceversa.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA sat;
