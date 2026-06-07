CREATE TABLE core.campos_obligatorios (
    id BIGSERIAL PRIMARY KEY,

    empresa_id INTEGER NOT NULL,

    entidad VARCHAR(50) NOT NULL,
    contexto VARCHAR(50) NULL,

    campo VARCHAR(100) NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX ux_campos_obligatorios
ON core.campos_obligatorios (
    empresa_id,
    entidad,
    contexto,
    campo
);

COMMENT ON TABLE core.campos_obligatorios IS
'Campos configurados como obligatorios por empresa, entidad y contexto. La tabla solo almacena excepciones: si un campo no existe aquí, se considera opcional.';

COMMENT ON COLUMN core.campos_obligatorios.id IS
'Identificador único del registro.';

COMMENT ON COLUMN core.campos_obligatorios.empresa_id IS
'Empresa a la que pertenece la configuración.';

COMMENT ON COLUMN core.campos_obligatorios.entidad IS
'Entidad funcional del sistema, por ejemplo contactos o documentos. No depende del nombre físico del formulario.';

COMMENT ON COLUMN core.campos_obligatorios.contexto IS
'Contexto específico de la entidad. En contactos puede ser el tipo de contacto; en documentos puede ser el tipo_documento. Puede ser NULL cuando la configuración aplique a toda la entidad.';

COMMENT ON COLUMN core.campos_obligatorios.campo IS
'Nombre técnico del campo dentro de la entidad.';

COMMENT ON COLUMN core.campos_obligatorios.created_at IS
'Fecha y hora en que se creó la configuración.';