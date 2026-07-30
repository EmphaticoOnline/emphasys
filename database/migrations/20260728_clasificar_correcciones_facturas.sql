BEGIN;

CREATE TABLE IF NOT EXISTS public.documentos_relaciones (
  id bigserial PRIMARY KEY,
  empresa_id integer NOT NULL REFERENCES core.empresas(id),
  documento_origen_id integer NOT NULL REFERENCES public.documentos(id),
  documento_destino_id integer NOT NULL REFERENCES public.documentos(id),
  tipo_relacion varchar(30) NOT NULL CHECK (tipo_relacion IN (
    'derivacion_operativa', 'regeneracion', 'correccion',
    'sustitucion_fiscal', 'duplicacion', 'referencia_interna'
  )),
  bloquea_cancelacion boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  activa boolean NOT NULL DEFAULT true,
  usuario_creacion_id integer NULL REFERENCES core.usuarios(id),
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  fecha_modificacion timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documentos_relaciones_documentos_distintos
    CHECK (documento_origen_id <> documento_destino_id),
  CONSTRAINT documentos_relaciones_par_unico
    UNIQUE (empresa_id, documento_origen_id, documento_destino_id)
);

DO $$
DECLARE
  inconsistencias text;
BEGIN
  WITH esperadas(origen_id, origen_serie, origen_numero, destino_id, destino_serie, destino_numero) AS (
    VALUES
      (152, 'B', 1, 1661, 'B', 18),
      (153, 'B', 2, 1665, 'B', 22),
      (154, 'B', 3, 1664, 'B', 21),
      (155, 'B', 4, 1663, 'B', 20),
      (156, 'B', 5, 1662, 'B', 19)
  )
  SELECT string_agg(format('%s→%s', e.origen_id, e.destino_id), ', ')
    INTO inconsistencias
    FROM esperadas e
    LEFT JOIN documentos o ON o.id = e.origen_id
    LEFT JOIN documentos d ON d.id = e.destino_id
   WHERE o.id IS NULL OR d.id IS NULL
      OR o.empresa_id <> 1 OR d.empresa_id <> 1
      OR LOWER(o.tipo_documento) <> 'factura' OR LOWER(d.tipo_documento) <> 'factura'
      OR COALESCE(o.serie, '') <> e.origen_serie OR o.numero <> e.origen_numero
      OR COALESCE(d.serie, '') <> e.destino_serie OR d.numero <> e.destino_numero
      OR d.documento_origen_id <> o.id;

  IF inconsistencias IS NOT NULL THEN
    RAISE EXCEPTION 'Relaciones de corrección distintas a las esperadas: %', inconsistencias;
  END IF;

  WITH esperadas(origen_id, destino_id) AS (
    VALUES (152,1661), (153,1665), (154,1664), (155,1663), (156,1662)
  )
  SELECT string_agg(format('%s→%s', e.origen_id, e.destino_id), ', ')
    INTO inconsistencias
    FROM esperadas e
    JOIN documentos_relaciones r
      ON r.empresa_id = 1
     AND r.documento_origen_id = e.origen_id
     AND r.documento_destino_id = e.destino_id
   WHERE r.tipo_relacion <> 'correccion'
      OR r.bloquea_cancelacion <> false
      OR r.activa <> true;

  IF inconsistencias IS NOT NULL THEN
    RAISE EXCEPTION 'Ya existen clasificaciones incompatibles: %', inconsistencias;
  END IF;
END $$;

INSERT INTO public.documentos_relaciones (
  empresa_id, documento_origen_id, documento_destino_id,
  tipo_relacion, bloquea_cancelacion, metadata
)
VALUES
  (1, 152, 1661, 'correccion', false, '{"origen":"correccion_emisor_2026","relacion_sat":false}'::jsonb),
  (1, 153, 1665, 'correccion', false, '{"origen":"correccion_emisor_2026","relacion_sat":false}'::jsonb),
  (1, 154, 1664, 'correccion', false, '{"origen":"correccion_emisor_2026","relacion_sat":false}'::jsonb),
  (1, 155, 1663, 'correccion', false, '{"origen":"correccion_emisor_2026","relacion_sat":false}'::jsonb),
  (1, 156, 1662, 'correccion', false, '{"origen":"correccion_emisor_2026","relacion_sat":false}'::jsonb)
ON CONFLICT (empresa_id, documento_origen_id, documento_destino_id)
DO NOTHING;

COMMIT;
