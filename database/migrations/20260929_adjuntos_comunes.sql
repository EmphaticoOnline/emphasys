BEGIN;

CREATE TABLE IF NOT EXISTS documentacion.adjuntos_tipos (
  id serial PRIMARY KEY,
  nombre varchar(120) NOT NULL UNIQUE,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documentacion.adjuntos_tipos_entidades (
  tipo_id integer NOT NULL REFERENCES documentacion.adjuntos_tipos(id) ON DELETE CASCADE,
  entidad_tipo varchar(40) NOT NULL CHECK (entidad_tipo IN ('empresa','documento','contacto','finanzas_operacion')),
  PRIMARY KEY (tipo_id, entidad_tipo)
);

CREATE TABLE IF NOT EXISTS documentacion.adjuntos (
  id serial PRIMARY KEY,
  empresa_id integer NOT NULL REFERENCES core.empresas(id),
  tipo_id bigint NULL,
  nombre_original varchar(255) NOT NULL,
  mime_type varchar(120) NOT NULL,
  tamano bigint NOT NULL,
  storage_key text NOT NULL UNIQUE,
  fecha_vencimiento date,
  comentarios text,
  creado_por integer REFERENCES core.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- La tabla ya existe y no contiene datos en la BD actual: se transforma in-place.
DROP INDEX IF EXISTS documentacion.adjuntos_empresa_documento_idx;
DROP INDEX IF EXISTS documentacion.adjuntos_empresa_fecha_idx;
DROP INDEX IF EXISTS documentacion.adjuntos_empresa_tipo_idx;
DROP INDEX IF EXISTS documentacion.adjuntos_empresa_vigente_idx;

ALTER TABLE documentacion.adjuntos
  ADD COLUMN IF NOT EXISTS mime_type varchar(120),
  ADD COLUMN IF NOT EXISTS tamano bigint,
  ADD COLUMN IF NOT EXISTS storage_key text,
  ADD COLUMN IF NOT EXISTS creado_por integer,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE documentacion.adjuntos
  DROP COLUMN IF EXISTS documento_id,
  DROP COLUMN IF EXISTS archivo_url,
  DROP COLUMN IF EXISTS fecha_subida,
  DROP COLUMN IF EXISTS vigente,
  DROP COLUMN IF EXISTS usuario_subio_id;

ALTER TABLE documentacion.adjuntos
  ALTER COLUMN tipo_id DROP NOT NULL;

-- El nombre legacy apunta al catálogo antiguo; debe reemplazarse explícitamente.
ALTER TABLE documentacion.adjuntos
  DROP CONSTRAINT IF EXISTS adjuntos_tipo_id_fkey;

ALTER TABLE documentacion.adjuntos
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN mime_type SET NOT NULL,
  ALTER COLUMN tamano SET NOT NULL,
  ALTER COLUMN storage_key SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='adjuntos_tipo_id_fkey') THEN
    ALTER TABLE documentacion.adjuntos ADD CONSTRAINT adjuntos_tipo_id_fkey FOREIGN KEY (tipo_id) REFERENCES documentacion.adjuntos_tipos(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='adjuntos_empresa_id_fkey') THEN
    ALTER TABLE documentacion.adjuntos ADD CONSTRAINT adjuntos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='adjuntos_creado_por_fkey') THEN
    ALTER TABLE documentacion.adjuntos ADD CONSTRAINT adjuntos_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES core.usuarios(id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS adjuntos_storage_key_uq ON documentacion.adjuntos(storage_key);
CREATE INDEX IF NOT EXISTS adjuntos_empresa_idx ON documentacion.adjuntos(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS adjuntos_tipo_idx ON documentacion.adjuntos(tipo_id);

CREATE TABLE IF NOT EXISTS documentacion.adjuntos_entidades (
  adjunto_id integer PRIMARY KEY REFERENCES documentacion.adjuntos(id) ON DELETE CASCADE,
  empresa_documentada_id integer REFERENCES core.empresas(id) ON DELETE CASCADE,
  documento_id integer REFERENCES public.documentos(id) ON DELETE CASCADE,
  contacto_id integer REFERENCES public.contactos(id) ON DELETE CASCADE,
  finanzas_operacion_id integer REFERENCES public.finanzas_operaciones(id) ON DELETE CASCADE,
  CONSTRAINT adjuntos_entidades_unico_propietario CHECK (
    num_nonnulls(empresa_documentada_id, documento_id, contacto_id, finanzas_operacion_id) = 1
  )
);
CREATE INDEX IF NOT EXISTS adjuntos_entidades_empresa_idx ON documentacion.adjuntos_entidades(empresa_documentada_id) WHERE empresa_documentada_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS adjuntos_entidades_documento_idx ON documentacion.adjuntos_entidades(documento_id) WHERE documento_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS adjuntos_entidades_contacto_idx ON documentacion.adjuntos_entidades(contacto_id) WHERE contacto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS adjuntos_entidades_finanzas_idx ON documentacion.adjuntos_entidades(finanzas_operacion_id) WHERE finanzas_operacion_id IS NOT NULL;

CREATE OR REPLACE FUNCTION documentacion.validar_adjunto_entidad_tenant()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tenant_id integer; entidad_tenant integer;
BEGIN
  SELECT empresa_id INTO tenant_id FROM documentacion.adjuntos WHERE id = NEW.adjunto_id FOR UPDATE;
  IF tenant_id IS NULL THEN RAISE EXCEPTION 'Adjunto % no encontrado', NEW.adjunto_id; END IF;
  IF NEW.empresa_documentada_id IS NOT NULL THEN
    IF NEW.empresa_documentada_id <> tenant_id THEN RAISE EXCEPTION 'Empresa documentada cross-tenant'; END IF;
  ELSIF NEW.documento_id IS NOT NULL THEN
    SELECT empresa_id INTO entidad_tenant FROM public.documentos WHERE id = NEW.documento_id;
    IF entidad_tenant IS DISTINCT FROM tenant_id THEN RAISE EXCEPTION 'Documento cross-tenant'; END IF;
  ELSIF NEW.contacto_id IS NOT NULL THEN
    SELECT empresa_id INTO entidad_tenant FROM public.contactos WHERE id = NEW.contacto_id;
    IF entidad_tenant IS DISTINCT FROM tenant_id THEN RAISE EXCEPTION 'Contacto cross-tenant'; END IF;
  ELSIF NEW.finanzas_operacion_id IS NOT NULL THEN
    SELECT empresa_id INTO entidad_tenant FROM public.finanzas_operaciones WHERE id = NEW.finanzas_operacion_id;
    IF entidad_tenant IS DISTINCT FROM tenant_id THEN RAISE EXCEPTION 'Operacion financiera cross-tenant'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS adjuntos_entidades_tenant_trg ON documentacion.adjuntos_entidades;
CREATE TRIGGER adjuntos_entidades_tenant_trg BEFORE INSERT OR UPDATE ON documentacion.adjuntos_entidades FOR EACH ROW EXECUTE FUNCTION documentacion.validar_adjunto_entidad_tenant();

-- Catálogo común; se conservan los catálogos legacy para rollback.
INSERT INTO documentacion.adjuntos_tipos(nombre, descripcion)
SELECT DISTINCT CASE
  WHEN lower(trim(nombre)) IN ('constancia fiscal','constancia de situación fiscal') THEN 'Constancia de situación fiscal'
  ELSE trim(nombre)
END, max(descripcion)
FROM (
  SELECT nombre, descripcion FROM documentacion.documentos_empresa_tipos
  UNION ALL
  SELECT nombre, NULL::text FROM public.contactos_documentacion_tipos
) x
WHERE trim(nombre) <> ''
GROUP BY CASE WHEN lower(trim(nombre)) IN ('constancia fiscal','constancia de situación fiscal') THEN 'Constancia de situación fiscal' ELSE trim(nombre) END
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO documentacion.adjuntos_tipos_entidades(tipo_id, entidad_tipo)
SELECT DISTINCT t.id, e.entidad_tipo
FROM documentacion.adjuntos_tipos t
CROSS JOIN LATERAL (VALUES
  (CASE WHEN EXISTS (SELECT 1 FROM documentacion.documentos_empresa_tipos x WHERE lower(trim(x.nombre))=lower(t.nombre)) THEN 'empresa' END),
  (CASE WHEN EXISTS (SELECT 1 FROM public.contactos_documentacion_tipos x WHERE lower(trim(x.nombre)) = CASE WHEN lower(t.nombre)='constancia de situación fiscal' THEN 'constancia fiscal' ELSE lower(t.nombre) END) THEN 'contacto' END)
) e(entidad_tipo)
WHERE e.entidad_tipo IS NOT NULL
ON CONFLICT DO NOTHING;

-- Migración idempotente de los cuatro registros actuales de Contactos.
INSERT INTO documentacion.adjuntos(empresa_id,tipo_id,nombre_original,mime_type,tamano,storage_key,fecha_vencimiento,comentarios,creado_por,created_at,updated_at)
SELECT d.empresa_id, t.id, d.nombre_original, d.mime_type, d.tamano, 'contactos/' || d.storage_key,
       d.fecha_vencimiento, d.comentarios, d.creado_por, d.created_at, d.updated_at
FROM public.contactos_documentacion d
JOIN documentacion.adjuntos_tipos t ON lower(t.nombre) = CASE WHEN lower(trim((SELECT nombre FROM public.contactos_documentacion_tipos WHERE id=d.tipo_id)))='constancia fiscal' THEN 'constancia de situación fiscal' ELSE lower(trim((SELECT nombre FROM public.contactos_documentacion_tipos WHERE id=d.tipo_id))) END
WHERE NOT EXISTS (SELECT 1 FROM documentacion.adjuntos a WHERE a.storage_key='contactos/' || d.storage_key);

INSERT INTO documentacion.adjuntos_entidades(adjunto_id, contacto_id)
SELECT a.id, d.contacto_id
FROM public.contactos_documentacion d
JOIN documentacion.adjuntos a ON a.storage_key='contactos/' || d.storage_key
WHERE NOT EXISTS (SELECT 1 FROM documentacion.adjuntos_entidades e WHERE e.adjunto_id=a.id);

COMMIT;
