-- PE-45: separar descripción breve de observaciones enriquecidas.
-- El rename preserva íntegramente los valores históricos de crm.actividades.notas.
DO $$
DECLARE
  total bigint;
  notas_null bigint;
  notas_con_contenido bigint;
  longitud_maxima integer;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE notas IS NULL),
         COUNT(*) FILTER (WHERE btrim(notas) <> ''), COALESCE(MAX(length(notas)), 0)
    INTO total, notas_null, notas_con_contenido, longitud_maxima
    FROM crm.actividades;
  RAISE NOTICE 'PE-45 actividades antes: total=%, notas_null=%, notas_con_contenido=%, longitud_maxima=%',
    total, notas_null, notas_con_contenido, longitud_maxima;
END $$;

ALTER TABLE crm.actividades RENAME COLUMN notas TO observaciones;
ALTER TABLE crm.actividades ADD COLUMN descripcion TEXT;

-- Verificación post-migración (sólo informativa; no modifica datos).
DO $$
DECLARE
  total bigint;
  observaciones_null bigint;
  observaciones_con_contenido bigint;
  longitud_maxima integer;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE observaciones IS NULL),
         COUNT(*) FILTER (WHERE btrim(observaciones) <> ''), COALESCE(MAX(length(observaciones)), 0)
    INTO total, observaciones_null, observaciones_con_contenido, longitud_maxima
    FROM crm.actividades;
  RAISE NOTICE 'PE-45 actividades: total=%, observaciones_null=%, observaciones_con_contenido=%, longitud_maxima=%',
    total, observaciones_null, observaciones_con_contenido, longitud_maxima;
END $$;
