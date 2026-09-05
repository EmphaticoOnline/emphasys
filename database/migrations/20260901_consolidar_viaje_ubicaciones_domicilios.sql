-- ============================================================================
-- Consolidación de Ubicaciones de Transporte sobre public.contactos_domicilios
-- ----------------------------------------------------------------------------
-- Decisión de modelo aprobada:
--   * transporte.ubicaciones deja de ser el maestro operativo.
--   * El maestro de domicilios/ubicaciones es public.contactos_domicilios
--     (propietario XOR Contacto / Empresa).
--   * transporte.viaje_ubicaciones pasa a referenciar directamente
--     public.contactos_domicilios(id) mediante la columna domicilio_id.
--
-- La migración es idempotente: puede ejecutarse varias veces sin efectos
-- adicionales. NO modifica snapshots históricos ni la Carta Porte timbrada.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Nueva columna domicilio_id (mismo tipo que contactos_domicilios.id).
-- ----------------------------------------------------------------------------
ALTER TABLE transporte.viaje_ubicaciones
  ADD COLUMN IF NOT EXISTS domicilio_id integer;

-- ----------------------------------------------------------------------------
-- 2. Migrar las referencias existentes desde ubicacion_id (legacy) al
--    contactos_domicilios equivalente.
--
--    Mapeo:
--      - ubicacion contacto-propietaria  -> domicilio del mismo contacto_id
--      - ubicacion empresa-propietaria   -> domicilio de la misma empresa_id
--    Desempate determinista: coincidencia de calle+num.ext.+CP, luego
--    es_principal, luego menor id.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'transporte'
       AND table_name   = 'viaje_ubicaciones'
       AND column_name  = 'ubicacion_id'
  ) THEN

    WITH candidatos AS (
      SELECT
        vu.id AS vu_id,
        cd.id AS domicilio_id,
        row_number() OVER (
          PARTITION BY vu.id
          ORDER BY
            (
              lower(coalesce(cd.calle, '')) = lower(coalesce(u.calle, ''))
              AND coalesce(cd.numero_exterior, '') = coalesce(u.numero_exterior, '')
              AND coalesce(cd.cp_sat, cd.cp, '') = coalesce(u.codigo_postal, '')
            ) DESC,
            cd.es_principal DESC,
            cd.id ASC
        ) AS rn,
        count(*) OVER (PARTITION BY vu.id) AS n_candidatos
      FROM transporte.viaje_ubicaciones vu
      JOIN transporte.ubicaciones u
        ON u.id = vu.ubicacion_id
       AND u.empresa_id = vu.empresa_id
      JOIN public.contactos_domicilios cd
        ON (
             (u.contacto_id IS NOT NULL AND cd.contacto_id = u.contacto_id)
          OR (u.empresa_contraparte_id IS NOT NULL AND cd.empresa_id = u.empresa_contraparte_id)
           )
      WHERE vu.ubicacion_id IS NOT NULL
        AND vu.domicilio_id IS NULL
    )
    UPDATE transporte.viaje_ubicaciones vu
       SET domicilio_id = candidatos.domicilio_id
      FROM candidatos
     WHERE candidatos.vu_id = vu.id
       AND candidatos.rn = 1;

  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Validar que todas las filas con ubicacion_id quedaron resueltas.
--    Si algo no se pudo mapear, aborta la migración para revisión manual.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  sin_resolver integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'transporte'
       AND table_name   = 'viaje_ubicaciones'
       AND column_name  = 'ubicacion_id'
  ) THEN
    SELECT count(*) INTO sin_resolver
      FROM transporte.viaje_ubicaciones
     WHERE ubicacion_id IS NOT NULL
       AND domicilio_id IS NULL;

    IF sin_resolver > 0 THEN
      RAISE EXCEPTION
        'Consolidación viaje_ubicaciones: % fila(s) sin domicilio_id equivalente en public.contactos_domicilios. Revisión manual requerida.',
        sin_resolver;
    END IF;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Retirar FK e índice legacy hacia transporte.ubicaciones.
-- ----------------------------------------------------------------------------
ALTER TABLE transporte.viaje_ubicaciones
  DROP CONSTRAINT IF EXISTS fk_transporte_viaje_ubicaciones_ubicacion;

DROP INDEX IF EXISTS transporte.ix_transporte_viaje_ubicaciones_ubicacion;

-- ----------------------------------------------------------------------------
-- 5. Eliminar la columna legacy ubicacion_id.
-- ----------------------------------------------------------------------------
ALTER TABLE transporte.viaje_ubicaciones
  DROP COLUMN IF EXISTS ubicacion_id;

-- ----------------------------------------------------------------------------
-- 6. Nueva FK e índice hacia public.contactos_domicilios.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'fk_transporte_viaje_ubicaciones_domicilio'
  ) THEN
    ALTER TABLE transporte.viaje_ubicaciones
      ADD CONSTRAINT fk_transporte_viaje_ubicaciones_domicilio
      FOREIGN KEY (domicilio_id)
      REFERENCES public.contactos_domicilios (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_transporte_viaje_ubicaciones_domicilio
  ON transporte.viaje_ubicaciones (empresa_id, domicilio_id)
  WHERE domicilio_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 7. Eliminar el maestro legacy transporte.ubicaciones si ya no tiene uso.
--    Condiciones de seguridad:
--      * no quedan FKs entrantes;
--      * sólo contiene filas de fixture Sandbox (CP_TEST_* / referencia Sandbox)
--        o está vacía.
--    Cualquier fila productiva inesperada aborta la migración.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  fks_entrantes integer;
  filas_no_fixture integer;
  filas_totales integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'transporte' AND table_name = 'ubicaciones'
  ) THEN

    SELECT count(*) INTO fks_entrantes
      FROM pg_constraint
     WHERE confrelid = 'transporte.ubicaciones'::regclass
       AND contype = 'f';

    IF fks_entrantes > 0 THEN
      RAISE EXCEPTION
        'transporte.ubicaciones conserva % FK(s) entrante(s); no se elimina.',
        fks_entrantes;
    END IF;

    SELECT count(*) INTO filas_totales FROM transporte.ubicaciones;

    SELECT count(*) INTO filas_no_fixture
      FROM transporte.ubicaciones
     WHERE coalesce(tipo_referencia, '') NOT LIKE 'CP\_TEST\_%' ESCAPE '\'
       AND coalesce(referencia, '') NOT ILIKE '%Sandbox%';

    IF filas_no_fixture > 0 THEN
      RAISE EXCEPTION
        'transporte.ubicaciones contiene % fila(s) no-fixture de % totales; revisión manual requerida antes de eliminar.',
        filas_no_fixture, filas_totales;
    END IF;

    DROP TABLE transporte.ubicaciones;
    RAISE NOTICE 'transporte.ubicaciones eliminada (% fila(s) de fixture Sandbox descartadas).', filas_totales;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 8. Fixture Sandbox: revincular el Viaje/Carta Porte de prueba (empresa 8)
--    a los domicilios de contactos_domicilios equivalentes, preservando el
--    snapshot histórico. Sólo actúa sobre viajes NO timbrados / sin CP timbrada.
--    (Idempotente: sólo escribe si domicilio_id sigue nulo.)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  UPDATE transporte.viaje_ubicaciones vu
     SET domicilio_id = cd.id
    FROM transporte.viajes v
    JOIN public.contactos c
      ON c.empresa_id = v.empresa_id
    JOIN public.contactos_domicilios cd
      ON cd.contacto_id = c.id
     AND cd.identificador = 'CP_TEST_FISCAL'
   WHERE vu.viaje_id = v.id
     AND vu.empresa_id = v.empresa_id
     AND vu.domicilio_id IS NULL
     AND c.codigo_legacy = ('CP_TEST_' || upper(vu.tipo))  -- CP_TEST_ORIGEN / CP_TEST_DESTINO
     AND NOT EXISTS (
       SELECT 1 FROM transporte.cartas_porte cp
        WHERE cp.viaje_id = v.id
          AND cp.empresa_id = v.empresa_id
          AND (cp.estatus = 'timbrado' OR cp.timbrado_at IS NOT NULL)
     );
END $$;

COMMIT;
