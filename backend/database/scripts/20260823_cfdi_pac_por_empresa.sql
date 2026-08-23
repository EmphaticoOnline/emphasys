BEGIN;

DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM core.empresas WHERE id = 8) THEN
    RAISE EXCEPTION 'No existe la empresa de pruebas 8 requerida para el backfill Sandbox.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM core.cfdi_pac_config
    WHERE lower(pac) = 'facturama' AND modo = 'sandbox'
  ) THEN
    RAISE EXCEPTION 'Falta la configuración Facturama Sandbox requerida.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM core.cfdi_pac_config
    WHERE lower(pac) = 'facturama' AND modo = 'produccion'
  ) THEN
    RAISE EXCEPTION 'Falta la configuración Facturama Producción requerida.';
  END IF;
END
$preflight$;

CREATE TABLE IF NOT EXISTS core.empresas_cfdi_pac_config (
  empresa_id integer PRIMARY KEY,
  cfdi_pac_config_id integer NOT NULL,
  csd_registrado boolean NOT NULL DEFAULT false,
  csd_fecha_actualizacion timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT fk_empresas_cfdi_pac_empresa
    FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_empresas_cfdi_pac_config
    FOREIGN KEY (cfdi_pac_config_id) REFERENCES core.cfdi_pac_config(id)
);

CREATE INDEX IF NOT EXISTS ix_empresas_cfdi_pac_config_id
  ON core.empresas_cfdi_pac_config (cfdi_pac_config_id, empresa_id);

-- activo significa disponible. Sandbox y Producción pueden estar disponibles simultáneamente.
DROP INDEX IF EXISTS core.ux_cfdi_pac_config_activo_modo;
CREATE UNIQUE INDEX IF NOT EXISTS ux_cfdi_pac_config_activo_pac_modo
  ON core.cfdi_pac_config (pac, modo) WHERE activo = true;

UPDATE core.cfdi_pac_config
SET activo = true, updated_at = now()
WHERE lower(pac) = 'facturama'
  AND modo IN ('sandbox', 'produccion')
  AND activo = false;

-- Empresas existentes: Producción. El estado CSD legado sólo se conserva para esa misma asignación.
INSERT INTO core.empresas_cfdi_pac_config
  (empresa_id, cfdi_pac_config_id, csd_registrado, csd_fecha_actualizacion)
SELECT e.id, cfg.id, e.cfdi_csd_registrado_facturama, e.cfdi_csd_fecha_actualizacion
FROM core.empresas e
JOIN core.cfdi_pac_config cfg
  ON lower(cfg.pac) = 'facturama' AND cfg.modo = 'produccion'
WHERE e.id <> 8
ON CONFLICT (empresa_id) DO NOTHING;

-- Empresa de prueba: Sandbox. No se presume que el CSD legado estuviera registrado en Sandbox.
INSERT INTO core.empresas_cfdi_pac_config
  (empresa_id, cfdi_pac_config_id, csd_registrado, csd_fecha_actualizacion)
SELECT e.id, cfg.id, false, NULL
FROM core.empresas e
JOIN core.cfdi_pac_config cfg
  ON lower(cfg.pac) = 'facturama' AND cfg.modo = 'sandbox'
WHERE e.id = 8
ON CONFLICT (empresa_id) DO UPDATE
SET cfdi_pac_config_id = EXCLUDED.cfdi_pac_config_id,
    csd_registrado = CASE
      WHEN core.empresas_cfdi_pac_config.cfdi_pac_config_id = EXCLUDED.cfdi_pac_config_id
        THEN core.empresas_cfdi_pac_config.csd_registrado
      ELSE false
    END,
    csd_fecha_actualizacion = CASE
      WHEN core.empresas_cfdi_pac_config.cfdi_pac_config_id = EXCLUDED.cfdi_pac_config_id
        THEN core.empresas_cfdi_pac_config.csd_fecha_actualizacion
      ELSE NULL
    END,
    updated_at = now();

ALTER TABLE public.documentos_cfdi
  ADD COLUMN IF NOT EXISTS cfdi_pac_config_id integer;
ALTER TABLE public.cfdi_intentos_timbrado
  ADD COLUMN IF NOT EXISTS cfdi_pac_config_id integer;
ALTER TABLE public.documentos_cancelacion_intentos
  ADD COLUMN IF NOT EXISTS cfdi_pac_config_id integer;

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_documentos_cfdi_pac_config' AND conrelid='public.documentos_cfdi'::regclass) THEN
    ALTER TABLE public.documentos_cfdi ADD CONSTRAINT fk_documentos_cfdi_pac_config
      FOREIGN KEY (cfdi_pac_config_id) REFERENCES core.cfdi_pac_config(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_cfdi_intentos_pac_config' AND conrelid='public.cfdi_intentos_timbrado'::regclass) THEN
    ALTER TABLE public.cfdi_intentos_timbrado ADD CONSTRAINT fk_cfdi_intentos_pac_config
      FOREIGN KEY (cfdi_pac_config_id) REFERENCES core.cfdi_pac_config(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_cancelacion_intentos_pac_config' AND conrelid='public.documentos_cancelacion_intentos'::regclass) THEN
    ALTER TABLE public.documentos_cancelacion_intentos ADD CONSTRAINT fk_cancelacion_intentos_pac_config
      FOREIGN KEY (cfdi_pac_config_id) REFERENCES core.cfdi_pac_config(id);
  END IF;
END
$constraints$;

CREATE INDEX IF NOT EXISTS ix_documentos_cfdi_pac_config
  ON public.documentos_cfdi (cfdi_pac_config_id) WHERE cfdi_pac_config_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_cfdi_intentos_pac_config
  ON public.cfdi_intentos_timbrado (cfdi_pac_config_id) WHERE cfdi_pac_config_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_cancelacion_intentos_pac_config
  ON public.documentos_cancelacion_intentos (cfdi_pac_config_id) WHERE cfdi_pac_config_id IS NOT NULL;

COMMIT;
