BEGIN;

-- Las dependencias derivadas de un documento no deben convertir una FK en
-- la regla de negocio que decide si una factura en borrador puede eliminarse.
-- La autoridad para esa decisión queda en la validación de aplicación.

ALTER TABLE transporte.viaje_documentos
  DROP CONSTRAINT IF EXISTS viaje_documentos_documento_id_fkey;
ALTER TABLE transporte.viaje_documentos
  ADD CONSTRAINT viaje_documentos_documento_id_fkey
  FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE CASCADE;

ALTER TABLE public.documentos_relaciones
  DROP CONSTRAINT IF EXISTS documentos_relaciones_documento_origen_id_fkey,
  DROP CONSTRAINT IF EXISTS documentos_relaciones_documento_destino_id_fkey;
ALTER TABLE public.documentos_relaciones
  ADD CONSTRAINT documentos_relaciones_documento_origen_id_fkey
    FOREIGN KEY (documento_origen_id) REFERENCES public.documentos(id) ON DELETE CASCADE,
  ADD CONSTRAINT documentos_relaciones_documento_destino_id_fkey
    FOREIGN KEY (documento_destino_id) REFERENCES public.documentos(id) ON DELETE CASCADE;

ALTER TABLE public.cfdi_intentos_timbrado
  DROP CONSTRAINT IF EXISTS cfdi_intentos_timbrado_documento_id_fkey;
ALTER TABLE public.cfdi_intentos_timbrado
  ADD CONSTRAINT cfdi_intentos_timbrado_documento_id_fkey
  FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE CASCADE;

ALTER TABLE public.documentos_cancelacion_intentos
  DROP CONSTRAINT IF EXISTS documentos_cancelacion_intentos_documento_id_fkey;
ALTER TABLE public.documentos_cancelacion_intentos
  ADD CONSTRAINT documentos_cancelacion_intentos_documento_id_fkey
  FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE CASCADE;

ALTER TABLE public.finanzas_programacion_pagos_detalle
  DROP CONSTRAINT IF EXISTS finanzas_programacion_pagos_detalle_documento_id_fkey;
ALTER TABLE public.finanzas_programacion_pagos_detalle
  ADD CONSTRAINT finanzas_programacion_pagos_detalle_documento_id_fkey
  FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE CASCADE;

ALTER TABLE public.finanzas_programacion_pagos
  DROP CONSTRAINT IF EXISTS finanzas_programacion_pagos_documento_id_fkey;
ALTER TABLE public.finanzas_programacion_pagos
  ADD CONSTRAINT finanzas_programacion_pagos_documento_id_fkey
  FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE CASCADE;

ALTER TABLE public.finanzas_aplicaciones
  DROP CONSTRAINT IF EXISTS fk_fa_documento;
ALTER TABLE public.finanzas_aplicaciones
  ADD CONSTRAINT fk_fa_documento
  FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE CASCADE;

ALTER TABLE public.aplicaciones_saldo
  DROP CONSTRAINT IF EXISTS fk_aplicaciones_doc_destino;
ALTER TABLE public.aplicaciones_saldo
  ADD CONSTRAINT fk_aplicaciones_doc_destino
  FOREIGN KEY (documento_destino_id) REFERENCES public.documentos(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones_entregas_partidas
  DROP CONSTRAINT IF EXISTS operaciones_entregas_partidas_documento_id_fkey,
  DROP CONSTRAINT IF EXISTS operaciones_entregas_partidas_partida_id_fkey;
ALTER TABLE public.operaciones_entregas_partidas
  ADD CONSTRAINT operaciones_entregas_partidas_documento_id_fkey
    FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE CASCADE,
  ADD CONSTRAINT operaciones_entregas_partidas_partida_id_fkey
    FOREIGN KEY (partida_id) REFERENCES public.documentos_partidas(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones_entregas
  DROP CONSTRAINT IF EXISTS operaciones_entregas_full_documento_id_fkey;
ALTER TABLE public.operaciones_entregas
  ADD CONSTRAINT operaciones_entregas_full_documento_id_fkey
  FOREIGN KEY (full_documento_id) REFERENCES public.documentos(id) ON DELETE CASCADE;

ALTER TABLE transporte.cartas_porte
  DROP CONSTRAINT IF EXISTS cartas_porte_documento_id_fkey;
ALTER TABLE transporte.cartas_porte
  ADD CONSTRAINT cartas_porte_documento_id_fkey
  FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE SET NULL;

ALTER TABLE public.autorizaciones_solicitudes
  DROP CONSTRAINT IF EXISTS autorizaciones_solicitudes_documento_origen_id_fkey;
ALTER TABLE public.autorizaciones_solicitudes
  ADD CONSTRAINT autorizaciones_solicitudes_documento_origen_id_fkey
  FOREIGN KEY (documento_origen_id) REFERENCES public.documentos(id) ON DELETE CASCADE;

-- Son registros históricos que pueden sobrevivir sin conservar una liga
-- eliminable al documento. No deben bloquear una factura en borrador.
ALTER TABLE contabilidad.contabilizaciones
  DROP CONSTRAINT IF EXISTS contabilizaciones_documento_id_fkey;
ALTER TABLE contabilidad.contabilizaciones
  ADD CONSTRAINT contabilizaciones_documento_id_fkey
  FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE SET NULL;

ALTER TABLE inventario.movimientos
  DROP CONSTRAINT IF EXISTS fk_inv_mov_documento;
ALTER TABLE inventario.movimientos
  ADD CONSTRAINT fk_inv_mov_documento
  FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE SET NULL;

ALTER TABLE core.cfdi_sat_comprobantes
  DROP CONSTRAINT IF EXISTS cfdi_sat_comprobantes_documento_id_fkey;
ALTER TABLE core.cfdi_sat_comprobantes
  ADD CONSTRAINT cfdi_sat_comprobantes_documento_id_fkey
  FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE SET NULL;

COMMIT;
