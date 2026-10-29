-- database/migrations/20261028_02_contactos_campos_migracion_clarion.sql
-- Columnas nuevas y ampliaciones en contactos para migrar Clientes desde Clarion.
-- En Clarion los teléfonos miden hasta 40 caracteres (vienen con texto libre, ej. "EXT 110").

BEGIN;

-- whatsapp.vcontactos_telefonos usa contactos.telefono; Postgres no deja cambiar el tipo
-- de una columna usada por una vista, así que se borra y se vuelve a crear igual.
DROP VIEW IF EXISTS whatsapp.vcontactos_telefonos;

ALTER TABLE public.contactos ALTER COLUMN telefono TYPE varchar(40);
ALTER TABLE public.contactos ALTER COLUMN telefono_secundario TYPE varchar(40);

CREATE VIEW whatsapp.vcontactos_telefonos AS
 WITH domicilio_principal AS (
         SELECT DISTINCT ON (d.contacto_id) d.contacto_id,
            d.ciudad,
            d.estado,
            d.pais
           FROM contactos_domicilios d
          ORDER BY d.contacto_id, d.es_principal DESC, d.id
        )
 SELECT c.id,
    c.empresa_id,
    c.nombre,
    dp.ciudad,
    dp.estado,
    dp.pais,
    c.email,
    whatsapp.fn_normaliza_telefono_e164(c.telefono::text) AS telefonoe164
   FROM contactos c
     LEFT JOIN domicilio_principal dp ON dp.contacto_id = c.id
  WHERE c.telefono IS NOT NULL;

COMMENT ON VIEW whatsapp.vcontactos_telefonos IS 'Vista que expone contactos con telefono normalizado y empresa asociada.';

-- La vista queda con el mismo dueño que la tabla contactos (no con quien corre la migración).
DO $$
BEGIN
  EXECUTE format('ALTER VIEW whatsapp.vcontactos_telefonos OWNER TO %I',
                 (SELECT tableowner FROM pg_tables WHERE schemaname = 'public' AND tablename = 'contactos'));
END $$;

ALTER TABLE public.contactos ADD COLUMN IF NOT EXISTS telefono_adicional varchar(40);
ALTER TABLE public.contactos ADD COLUMN IF NOT EXISTS pagina_web varchar(50);
ALTER TABLE public.contactos ADD COLUMN IF NOT EXISTS fecha_inicio_relaciones date;
ALTER TABLE public.contactos ADD COLUMN IF NOT EXISTS descuento_predeterminado varchar(40);

ALTER TABLE public.contactos DROP CONSTRAINT IF EXISTS chk_contactos_descuento_formato;
ALTER TABLE public.contactos ADD CONSTRAINT chk_contactos_descuento_formato
  CHECK (descuento_predeterminado IS NULL OR descuento_predeterminado ~ '^[0-9]+(\.[0-9]+)?(\+[0-9]+(\.[0-9]+)?)*$');

ALTER TABLE public.contactos_adicionales ADD COLUMN IF NOT EXISTS enviar_cfdi boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contactos.telefono_adicional IS 'Tercer teléfono del contacto.';
COMMENT ON COLUMN public.contactos.pagina_web IS 'Dirección de la página web del contacto.';
COMMENT ON COLUMN public.contactos.fecha_inicio_relaciones IS 'Fecha de inicio de relaciones comerciales con el contacto.';
COMMENT ON COLUMN public.contactos.descuento_predeterminado IS 'Descuento por omisión como texto; admite cascada, ej. 25+3+2.5.';
COMMENT ON COLUMN public.contactos_adicionales.enviar_cfdi IS 'Indica si a esta persona se le envía el CFDI.';

COMMIT;
