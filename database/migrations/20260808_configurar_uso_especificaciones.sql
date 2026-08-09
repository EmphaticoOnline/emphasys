BEGIN;

INSERT INTO core.parametros (
    clave,
    nombre,
    tipo_dato,
    tipo_control,
    valor_default
)
VALUES (
    'usar_especificaciones_productos',
    'Usar especificaciones de productos',
    'boolean',
    'switch',
    'false'
)
ON CONFLICT (clave) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    tipo_dato = EXCLUDED.tipo_dato,
    tipo_control = EXCLUDED.tipo_control,
    valor_default = EXCLUDED.valor_default;

ALTER TABLE core.empresas_tipos_documento
    ADD COLUMN IF NOT EXISTS usar_especificaciones boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN core.empresas_tipos_documento.usar_especificaciones IS
    'Habilita la captura de especificaciones para este tipo de documento cuando el parametro general de la empresa tambien esta activo.';

COMMIT;
