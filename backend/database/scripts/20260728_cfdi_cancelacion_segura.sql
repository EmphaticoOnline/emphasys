BEGIN;

ALTER TABLE public.documentos_cfdi
  ADD COLUMN IF NOT EXISTS pac_modalidad varchar(10),
  ADD COLUMN IF NOT EXISTS cancelacion_estado varchar(30) NOT NULL DEFAULT 'no_solicitada',
  ADD COLUMN IF NOT EXISTS cancelacion_proveedor_status varchar(40),
  ADD COLUMN IF NOT EXISTS cancelacion_ultima_consulta_at timestamptz;

ALTER TABLE public.documentos_cfdi
  DROP CONSTRAINT IF EXISTS documentos_cfdi_pac_modalidad_check,
  DROP CONSTRAINT IF EXISTS documentos_cfdi_cancelacion_estado_check;

ALTER TABLE public.documentos_cfdi
  ADD CONSTRAINT documentos_cfdi_pac_modalidad_check
    CHECK (pac_modalidad IS NULL OR pac_modalidad IN ('web', 'lite')),
  ADD CONSTRAINT documentos_cfdi_cancelacion_estado_check
    CHECK (cancelacion_estado IN (
      'no_solicitada',
      'solicitada',
      'pendiente',
      'cancelada',
      'rechazada',
      'error',
      'requiere_reconciliacion'
    ));

ALTER TABLE public.documentos_cancelacion_intentos
  ADD COLUMN IF NOT EXISTS proveedor varchar(50),
  ADD COLUMN IF NOT EXISTS pac_id varchar(100),
  ADD COLUMN IF NOT EXISTS modalidad varchar(10),
  ADD COLUMN IF NOT EXISTS rfc_emisor text,
  ADD COLUMN IF NOT EXISTS endpoint text,
  ADD COLUMN IF NOT EXISTS proveedor_status varchar(40),
  ADD COLUMN IF NOT EXISTS fecha_solicitud timestamptz,
  ADD COLUMN IF NOT EXISTS intentos_consulta integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_codigo varchar(100),
  ADD COLUMN IF NOT EXISTS mensaje_sanitizado text,
  ADD COLUMN IF NOT EXISTS acuse_xml text;

ALTER TABLE public.documentos_cancelacion_intentos
  DROP CONSTRAINT IF EXISTS documentos_cancelacion_intentos_estado_check,
  DROP CONSTRAINT IF EXISTS documentos_cancelacion_intentos_modalidad_check;

ALTER TABLE public.documentos_cancelacion_intentos
  ADD CONSTRAINT documentos_cancelacion_intentos_estado_check CHECK (estado IN (
    'iniciado',
    'solicitada',
    'pendiente',
    'cancelada',
    'rechazada',
    'error',
    'requiere_reconciliacion',
    'completado',
    'externo_ok',
    'externo_ok_interno_pendiente',
    'error_externo',
    'error_interno'
  )),
  ADD CONSTRAINT documentos_cancelacion_intentos_modalidad_check
    CHECK (modalidad IS NULL OR modalidad IN ('web', 'lite'));

CREATE INDEX IF NOT EXISTS idx_dci_pac_recurso
  ON public.documentos_cancelacion_intentos (proveedor, modalidad, pac_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_dci_solicitud_activa
  ON public.documentos_cancelacion_intentos (documento_id)
  WHERE estado IN ('iniciado', 'solicitada', 'pendiente', 'requiere_reconciliacion');

COMMIT;
