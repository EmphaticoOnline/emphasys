BEGIN;

ALTER TABLE public.contactos_domicilios
  ADD COLUMN IF NOT EXISTS empresa_id integer,
  ADD COLUMN IF NOT EXISTS tipo_referencia varchar(50),
  ADD COLUMN IF NOT EXISTS latitud numeric(10,7),
  ADD COLUMN IF NOT EXISTS longitud numeric(10,7),
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.contactos_domicilios
  ALTER COLUMN contacto_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_cd_empresa'
      AND conrelid = 'public.contactos_domicilios'::regclass
  ) THEN
    ALTER TABLE public.contactos_domicilios
      ADD CONSTRAINT fk_cd_empresa
      FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_cd_exactly_one_owner'
      AND conrelid = 'public.contactos_domicilios'::regclass
  ) THEN
    ALTER TABLE public.contactos_domicilios
      ADD CONSTRAINT ck_cd_exactly_one_owner
      CHECK ((contacto_id IS NOT NULL) <> (empresa_id IS NOT NULL));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_cd_latitud'
      AND conrelid = 'public.contactos_domicilios'::regclass
  ) THEN
    ALTER TABLE public.contactos_domicilios
      ADD CONSTRAINT ck_cd_latitud
      CHECK (latitud IS NULL OR latitud BETWEEN -90 AND 90);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_cd_longitud'
      AND conrelid = 'public.contactos_domicilios'::regclass
  ) THEN
    ALTER TABLE public.contactos_domicilios
      ADD CONSTRAINT ck_cd_longitud
      CHECK (longitud IS NULL OR longitud BETWEEN -180 AND 180);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_cd_empresa_identificador
  ON public.contactos_domicilios (empresa_id, identificador)
  WHERE empresa_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_empresas_domicilios_principal
  ON public.contactos_domicilios (empresa_id)
  WHERE empresa_id IS NOT NULL AND es_principal = true;

COMMIT;
