-- =========================================================
-- Notas de crédito - campos base
-- =========================================================

ALTER TABLE public.documentos
ADD COLUMN motivo_nc varchar(20) NULL,
ADD COLUMN concepto_id int4 NULL;

COMMENT ON COLUMN public.documentos.motivo_nc IS
'Motivo de la nota de crédito. Valores esperados: devolucion, bonificacion, otro.';

COMMENT ON COLUMN public.documentos.concepto_id IS
'Concepto contable/comercial asociado al documento. Utilizado para contabilización y clasificación.';

-- =========================================================
-- FK concepto
-- =========================================================

ALTER TABLE public.documentos
ADD CONSTRAINT fk_documentos_concepto
FOREIGN KEY (concepto_id)
REFERENCES public.conceptos(id)
ON DELETE RESTRICT;

-- =========================================================
-- Índices
-- =========================================================

CREATE INDEX idx_documentos_motivo_nc
ON public.documentos(motivo_nc);

CREATE INDEX idx_documentos_concepto_id
ON public.documentos(concepto_id);

-- =========================================================
-- Validación básica motivo_nc
-- =========================================================

ALTER TABLE public.documentos
ADD CONSTRAINT chk_documentos_motivo_nc
CHECK (
    motivo_nc IS NULL
    OR motivo_nc IN (
        'devolucion',
        'bonificacion',
        'otro'
    )
);