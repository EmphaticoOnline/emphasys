-- Permite excluir vendedores individuales del round-robin sin desactivarlos.
-- Idempotente y compatible: los vendedores existentes participan por defecto.
BEGIN;

ALTER TABLE public.contactos
  ADD COLUMN IF NOT EXISTS participa_en_round_robin boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.contactos.participa_en_round_robin IS
  'Indica si un contacto de tipo Vendedor participa en la asignación automática round-robin de su empresa. No afecta asignaciones manuales ni el estado activo.';

COMMIT;
