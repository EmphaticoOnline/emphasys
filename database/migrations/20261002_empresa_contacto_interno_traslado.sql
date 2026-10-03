BEGIN;

ALTER TABLE core.empresas
  ADD COLUMN contacto_id integer;

ALTER TABLE core.empresas
  ADD CONSTRAINT fk_core_empresas_contacto
  FOREIGN KEY (contacto_id) REFERENCES public.contactos(id);

CREATE INDEX ix_core_empresas_contacto_id
  ON core.empresas (contacto_id);

COMMENT ON COLUMN core.empresas.contacto_id IS
  'Contacto interno técnico que representa a la propia empresa para documentos de Traslado.';

COMMIT;
