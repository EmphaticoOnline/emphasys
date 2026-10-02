BEGIN;

ALTER TABLE transporte.viaje_documentos
  DROP CONSTRAINT IF EXISTS ck_transporte_viaje_documentos_tipo;

ALTER TABLE transporte.viaje_documentos
  ADD CONSTRAINT ck_transporte_viaje_documentos_tipo
  CHECK (tipo_relacion IN ('factura_servicio', 'traslado'));

COMMIT;
