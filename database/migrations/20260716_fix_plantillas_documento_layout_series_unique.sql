-- =========================================================
-- FIX: unicidad de plantillas_documento no distinguía
-- configuración base de empresa vs. configuración de serie.
--
-- Síntoma: al guardar un formato de impresión específico de
-- serie (ej. Factura / Serie B) el backend intentaba INSERTAR
-- una nueva fila activa en plantillas_documento y chocaba con
-- ux_plantilla_activa (empresa_id, tipo_documento) WHERE activo,
-- porque ese índice sólo permitía UNA fila activa por
-- empresa+tipo_documento, sin importar si era la plantilla base
-- de empresa o una plantilla de serie enlazada vía
-- series_documento.layout_id.
--
-- Esta migración:
--   1) agrega la columna "serie" a plantillas_documento para que
--      cada fila declare explícitamente su alcance,
--   2) rellena esa columna para filas ya enlazadas desde
--      series_documento.layout_id (dato preexistente, no se toca
--      contenido ni se borra nada),
--   3) reporta (y aborta, sin modificar nada) si detecta
--      duplicados que violarían los nuevos índices únicos,
--   4) reemplaza el índice único incorrecto por dos índices
--      parciales: uno para la plantilla base (serie IS NULL) y
--      otro para plantillas de serie (serie IS NOT NULL).
-- =========================================================

BEGIN;

-- 1) Columna de alcance por serie (NULL = plantilla base de empresa)
ALTER TABLE public.plantillas_documento
  ADD COLUMN IF NOT EXISTS serie varchar(20) NULL;

COMMENT ON COLUMN public.plantillas_documento.serie IS
'Serie a la que pertenece esta plantilla de layout (varchar igual que series_documento.serie). NULL indica la plantilla base de la empresa para el tipo_documento.';

-- 2) Backfill: si una fila ya está enlazada desde series_documento.layout_id
-- pero aún no tiene "serie" asignada, se completa con el valor de la serie
-- que la referencia. No modifica contenido_html ni configuracion.
UPDATE public.plantillas_documento pd
   SET serie = sd.serie
  FROM public.series_documento sd
 WHERE sd.layout_id = pd.id
   AND pd.serie IS NULL;

-- 3) Diagnóstico previo: si ya existieran duplicados que violarían los
-- nuevos índices únicos parciales, abortar la migración (no se pierde
-- nada, sólo no se aplica el cambio) y reportarlos para revisión manual.
DO $$
DECLARE
  dup_base RECORD;
  dup_serie RECORD;
  hay_duplicados boolean := false;
BEGIN
  FOR dup_base IN
    SELECT empresa_id, tipo_documento, COUNT(*) AS total,
           array_agg(id ORDER BY id) AS ids
      FROM public.plantillas_documento
     WHERE activo = true
       AND serie IS NULL
     GROUP BY empresa_id, tipo_documento
    HAVING COUNT(*) > 1
  LOOP
    hay_duplicados := true;
    RAISE NOTICE 'Duplicado BASE: empresa_id=%, tipo_documento=%, total=%, ids=%',
      dup_base.empresa_id, dup_base.tipo_documento, dup_base.total, dup_base.ids;
  END LOOP;

  FOR dup_serie IN
    SELECT empresa_id, tipo_documento, serie, COUNT(*) AS total,
           array_agg(id ORDER BY id) AS ids
      FROM public.plantillas_documento
     WHERE activo = true
       AND serie IS NOT NULL
     GROUP BY empresa_id, tipo_documento, serie
    HAVING COUNT(*) > 1
  LOOP
    hay_duplicados := true;
    RAISE NOTICE 'Duplicado SERIE: empresa_id=%, tipo_documento=%, serie=%, total=%, ids=%',
      dup_serie.empresa_id, dup_serie.tipo_documento, dup_serie.serie, dup_serie.total, dup_serie.ids;
  END LOOP;

  IF hay_duplicados THEN
    RAISE EXCEPTION 'Se encontraron plantillas activas duplicadas (ver NOTICE arriba). Resuelve manualmente (desactivando las filas sobrantes) antes de re-ejecutar esta migración.';
  END IF;
END $$;

-- 4) Reemplazo del índice único incorrecto por dos índices parciales
DROP INDEX IF EXISTS public.ux_plantilla_activa;

CREATE UNIQUE INDEX IF NOT EXISTS ux_plantilla_activa_base
  ON public.plantillas_documento (empresa_id, tipo_documento)
  WHERE activo = true AND serie IS NULL;

COMMENT ON INDEX public.ux_plantilla_activa_base IS
'Garantiza una única plantilla base activa por empresa y tipo_documento (serie IS NULL).';

CREATE UNIQUE INDEX IF NOT EXISTS ux_plantilla_activa_serie
  ON public.plantillas_documento (empresa_id, tipo_documento, serie)
  WHERE activo = true AND serie IS NOT NULL;

COMMENT ON INDEX public.ux_plantilla_activa_serie IS
'Garantiza una única plantilla activa por empresa, tipo_documento y serie (serie IS NOT NULL).';

CREATE INDEX IF NOT EXISTS idx_plantillas_documento_empresa_tipo_serie
  ON public.plantillas_documento (empresa_id, tipo_documento, serie);

COMMIT;
