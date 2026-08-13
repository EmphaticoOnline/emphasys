BEGIN;

ALTER TABLE core.empresas_tipos_documento
    ADD COLUMN IF NOT EXISTS colorear_filas_por_estatus boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN core.empresas_tipos_documento.colorear_filas_por_estatus IS
'Habilita un tinte visual de las filas del listado segun la semantica de estatus definida por Emphasys para este tipo documental.';

COMMIT;
