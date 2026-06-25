-- =============================================================================
-- Fase 3 — Métodos de Pago Operativos de Tesorería
-- tabla: public.finanzas_metodos_pago
-- columna: public.finanzas_operaciones.metodo_pago_id
-- =============================================================================
-- Propósito: catálogo por empresa de cómo se realizó un pago (efectivo,
-- transferencia, cheque, etc.). DISTINTO de sat.formas_pago (CFDI).
-- El campo forma_pago_sat es solo informativo; no afecta timbrado.
-- =============================================================================

-- 1. Tabla del catálogo ---------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finanzas_metodos_pago (
    id                  serial      PRIMARY KEY,
    empresa_id          integer     NOT NULL,
    clave               varchar(40) NOT NULL,
    nombre              varchar(100) NOT NULL,
    activo              boolean     NOT NULL DEFAULT true,
    requiere_referencia boolean     NOT NULL DEFAULT false,
    es_efectivo         boolean     NOT NULL DEFAULT false,
    forma_pago_sat      text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_finanzas_metodos_pago_empresa_clave UNIQUE (empresa_id, clave)
);

COMMENT ON TABLE  public.finanzas_metodos_pago IS 'Catálogo operativo de métodos de pago por empresa (efectivo, SPEI, cheque, tarjeta…). No confundir con sat.formas_pago (CFDI).';
COMMENT ON COLUMN public.finanzas_metodos_pago.forma_pago_sat IS 'Código SAT sugerido (informativo). No se usa para timbrar ni modifica documentos.forma_pago.';
COMMENT ON COLUMN public.finanzas_metodos_pago.requiere_referencia IS 'Si true, la operación debe informar el campo referencia (número de cheque, SPEI, etc.).';

CREATE INDEX IF NOT EXISTS idx_finanzas_metodos_pago_empresa
    ON public.finanzas_metodos_pago (empresa_id);

-- 2. Columna en finanzas_operaciones --------------------------------------

ALTER TABLE public.finanzas_operaciones
    ADD COLUMN IF NOT EXISTS metodo_pago_id integer
        REFERENCES public.finanzas_metodos_pago(id)
        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finanzas_operaciones_metodo_pago
    ON public.finanzas_operaciones (metodo_pago_id)
    WHERE metodo_pago_id IS NOT NULL;

-- 3. Seed: 7 métodos estándar por cada empresa existente ------------------
-- Idempotente: ON CONFLICT (empresa_id, clave) DO NOTHING

INSERT INTO public.finanzas_metodos_pago
    (empresa_id, clave, nombre, activo, requiere_referencia, es_efectivo, forma_pago_sat)
SELECT
    e.id,
    m.clave,
    m.nombre,
    true,
    m.requiere_referencia,
    m.es_efectivo,
    m.forma_pago_sat
FROM core.empresas e
CROSS JOIN (VALUES
    ('efectivo',        'Efectivo',              false::boolean, true::boolean,  '01'),
    ('transferencia',   'Transferencia (SPEI)',   true::boolean,  false::boolean, '03'),
    ('cheque',          'Cheque',                 true::boolean,  false::boolean, '02'),
    ('tarjeta_credito', 'Tarjeta de crédito',     true::boolean,  false::boolean, '04'),
    ('tarjeta_debito',  'Tarjeta de débito',      true::boolean,  false::boolean, '28'),
    ('deposito',        'Depósito bancario',      true::boolean,  false::boolean, '03'),
    ('otro',            'Otro',                   false::boolean, false::boolean, NULL::text)
) AS m(clave, nombre, requiere_referencia, es_efectivo, forma_pago_sat)
ON CONFLICT (empresa_id, clave) DO NOTHING;
