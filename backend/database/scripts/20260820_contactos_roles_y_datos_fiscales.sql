BEGIN;

CREATE TABLE IF NOT EXISTS public.contactos_roles_catalogo (
  rol varchar(50) PRIMARY KEY,
  descripcion varchar(150) NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_contactos_roles_catalogo_rol CHECK (btrim(rol) <> '')
);

INSERT INTO public.contactos_roles_catalogo (rol, descripcion)
VALUES
  ('cliente', 'Puede participar como cliente'),
  ('proveedor', 'Puede participar como proveedor'),
  ('vendedor', 'Puede participar como vendedor'),
  ('operador', 'Puede participar como operador logístico'),
  ('fletera', 'Puede participar como fletera'),
  ('facturador', 'Puede participar como facturador'),
  ('socio_comercial', 'Puede participar como socio comercial')
ON CONFLICT (rol) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.contactos_roles (
  contacto_id integer NOT NULL,
  rol varchar(50) NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  origen varchar(50),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_contactos_roles PRIMARY KEY (contacto_id, rol),
  CONSTRAINT fk_contactos_roles_contacto
    FOREIGN KEY (contacto_id) REFERENCES public.contactos(id) ON DELETE CASCADE,
  CONSTRAINT fk_contactos_roles_catalogo
    FOREIGN KEY (rol) REFERENCES public.contactos_roles_catalogo(rol),
  CONSTRAINT ck_contactos_roles_origen
    CHECK (origen IS NULL OR btrim(origen) <> '')
);

CREATE INDEX IF NOT EXISTS ix_contactos_roles_rol_activo
  ON public.contactos_roles (rol, contacto_id)
  WHERE activo = true;

ALTER TABLE public.contactos_datos_fiscales
  ADD COLUMN IF NOT EXISTS razon_social_fiscal varchar(200),
  ADD COLUMN IF NOT EXISTS codigo_postal_fiscal varchar(5);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_contactos_datos_fiscales_cp'
      AND conrelid = 'public.contactos_datos_fiscales'::regclass
  ) THEN
    ALTER TABLE public.contactos_datos_fiscales
      ADD CONSTRAINT ck_contactos_datos_fiscales_cp
      CHECK (codigo_postal_fiscal IS NULL OR codigo_postal_fiscal ~ '^[0-9]{5}$');
  END IF;
END
$$;

ALTER TABLE public.contactos_domicilios
  ADD COLUMN IF NOT EXISTS texto_original text;

COMMENT ON TABLE public.contactos_roles_catalogo IS
  'Catálogo extensible de capacidades que puede desempeñar un contacto.';
COMMENT ON TABLE public.contactos_roles IS
  'Roles múltiples de contactos; tipo_contacto se conserva temporalmente por compatibilidad.';
COMMENT ON COLUMN public.contactos_roles.origen IS
  'Procedencia de la asignación del rol, por ejemplo DICOR o MANUAL.';
COMMENT ON COLUMN public.contactos_datos_fiscales.razon_social_fiscal IS
  'Razón social fiscal explícita; no debe inferirse automáticamente del nombre comercial.';
COMMENT ON COLUMN public.contactos_datos_fiscales.codigo_postal_fiscal IS
  'Código postal del domicilio fiscal del receptor.';
COMMENT ON COLUMN public.contactos_domicilios.texto_original IS
  'Texto histórico completo del domicilio antes de cualquier normalización.';

COMMIT;
