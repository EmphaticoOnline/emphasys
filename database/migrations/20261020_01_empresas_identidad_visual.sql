-- Identidad visual por empresa (White Label, etapa 2 · E3).
-- Tabla 1:1 con core.empresas. Sin fila, o con un color en NULL, la empresa usa la identidad de Emphasys.
-- El logo sigue en core.empresas_assets (tipo 'logo_default'); aquí solo se guarda qué logo se analizó.
-- Verificado contra el esquema real (2026-10-20): core.empresas.id, core.empresas_assets.id y
-- core.usuarios.id son integer PRIMARY KEY; la tabla no existía.
-- Reversión manual: DROP TABLE core.empresas_identidad_visual;

BEGIN;

CREATE TABLE core.empresas_identidad_visual (
  empresa_id                  integer PRIMARY KEY
                              REFERENCES core.empresas(id) ON DELETE CASCADE,

  -- Colores aprobados (hex en minúsculas; NULL = Emphasys)
  color_primario              char(7) NULL,
  color_acento                char(7) NULL,
  color_sidebar               char(7) NULL,
  origen_primario             text NOT NULL DEFAULT 'emphasys',
  origen_acento               text NOT NULL DEFAULT 'emphasys',
  origen_sidebar              text NOT NULL DEFAULT 'emphasys',

  -- Última propuesta del análisis del logo (se conserva para restaurarla)
  propuesta_primario          char(7) NULL,
  propuesta_acento            char(7) NULL,
  propuesta_sidebar           char(7) NULL,
  propuesta_estado            text NULL,
  propuesta_confianza         numeric(4,3) NULL,
  propuesta_detalle           jsonb NULL,
  propuesta_asset_id          integer NULL
                              REFERENCES core.empresas_assets(id) ON DELETE SET NULL,
  propuesta_algoritmo_version smallint NULL,
  propuesta_generada_at       timestamptz NULL,

  actualizado_por             integer NULL
                              REFERENCES core.usuarios(id) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  -- Formato hex normalizado
  CONSTRAINT eiv_color_primario_hex CHECK (color_primario     IS NULL OR color_primario     ~ '^#[0-9a-f]{6}$'),
  CONSTRAINT eiv_color_acento_hex   CHECK (color_acento       IS NULL OR color_acento       ~ '^#[0-9a-f]{6}$'),
  CONSTRAINT eiv_color_sidebar_hex  CHECK (color_sidebar      IS NULL OR color_sidebar      ~ '^#[0-9a-f]{6}$'),
  CONSTRAINT eiv_prop_primario_hex  CHECK (propuesta_primario IS NULL OR propuesta_primario ~ '^#[0-9a-f]{6}$'),
  CONSTRAINT eiv_prop_acento_hex    CHECK (propuesta_acento   IS NULL OR propuesta_acento   ~ '^#[0-9a-f]{6}$'),
  CONSTRAINT eiv_prop_sidebar_hex   CHECK (propuesta_sidebar  IS NULL OR propuesta_sidebar  ~ '^#[0-9a-f]{6}$'),

  -- Origen válido y coherente: 'emphasys' si y solo si el color es NULL
  CONSTRAINT eiv_origen_primario CHECK (origen_primario IN ('emphasys', 'analisis', 'manual')
                                        AND (color_primario IS NULL) = (origen_primario = 'emphasys')),
  CONSTRAINT eiv_origen_acento   CHECK (origen_acento   IN ('emphasys', 'analisis', 'manual')
                                        AND (color_acento   IS NULL) = (origen_acento   = 'emphasys')),
  CONSTRAINT eiv_origen_sidebar  CHECK (origen_sidebar  IN ('emphasys', 'analisis', 'manual')
                                        AND (color_sidebar  IS NULL) = (origen_sidebar  = 'emphasys')),

  -- Propuesta: 'ok' trae los 3 colores; sin estado o sin colores útiles, ninguno
  CONSTRAINT eiv_propuesta_estado CHECK (propuesta_estado IS NULL
                                         OR propuesta_estado IN ('ok', 'sin_colores_utiles', 'error')),
  CONSTRAINT eiv_propuesta_colores CHECK (
    CASE WHEN propuesta_estado = 'ok'
         THEN propuesta_primario IS NOT NULL AND propuesta_acento IS NOT NULL AND propuesta_sidebar IS NOT NULL
         ELSE propuesta_primario IS NULL AND propuesta_acento IS NULL AND propuesta_sidebar IS NULL
    END),
  CONSTRAINT eiv_propuesta_fecha CHECK ((propuesta_estado IS NULL) = (propuesta_generada_at IS NULL)),
  CONSTRAINT eiv_propuesta_confianza CHECK (propuesta_confianza IS NULL
                                            OR propuesta_confianza BETWEEN 0 AND 1),
  CONSTRAINT eiv_propuesta_detalle CHECK (propuesta_detalle IS NULL
                                          OR jsonb_typeof(propuesta_detalle) = 'object')
);

COMMENT ON TABLE  core.empresas_identidad_visual IS 'Identidad visual por empresa (1:1). Sin fila o con color NULL se usa la identidad de Emphasys. El logo vive en core.empresas_assets (logo_default).';
COMMENT ON COLUMN core.empresas_identidad_visual.empresa_id                  IS 'Empresa (core.empresas). Se elimina junto con la empresa.';
COMMENT ON COLUMN core.empresas_identidad_visual.color_primario              IS 'Color primario aprobado (#rrggbb). NULL = Emphasys.';
COMMENT ON COLUMN core.empresas_identidad_visual.color_acento                IS 'Color de acento aprobado (#rrggbb); reemplaza solo el acento de marca. NULL = Emphasys.';
COMMENT ON COLUMN core.empresas_identidad_visual.color_sidebar               IS 'Color del sidebar aprobado (#rrggbb); de él se derivan los grafitos. NULL = Emphasys.';
COMMENT ON COLUMN core.empresas_identidad_visual.origen_primario             IS 'emphasys | analisis | manual. Un color manual no se sobrescribe sin confirmación.';
COMMENT ON COLUMN core.empresas_identidad_visual.origen_acento               IS 'emphasys | analisis | manual. Un color manual no se sobrescribe sin confirmación.';
COMMENT ON COLUMN core.empresas_identidad_visual.origen_sidebar              IS 'emphasys | analisis | manual. Un color manual no se sobrescribe sin confirmación.';
COMMENT ON COLUMN core.empresas_identidad_visual.propuesta_primario          IS 'Primario propuesto por el último análisis del logo.';
COMMENT ON COLUMN core.empresas_identidad_visual.propuesta_acento            IS 'Acento propuesto por el último análisis del logo.';
COMMENT ON COLUMN core.empresas_identidad_visual.propuesta_sidebar           IS 'Sidebar propuesto por el último análisis del logo.';
COMMENT ON COLUMN core.empresas_identidad_visual.propuesta_estado            IS 'ok | sin_colores_utiles | error. NULL = nunca analizado.';
COMMENT ON COLUMN core.empresas_identidad_visual.propuesta_confianza         IS 'Confianza del análisis, de 0 a 1.';
COMMENT ON COLUMN core.empresas_identidad_visual.propuesta_detalle           IS 'Diagnóstico técnico del análisis (candidatos, contrastes, ajustes). Visible solo para superadministradores.';
COMMENT ON COLUMN core.empresas_identidad_visual.propuesta_asset_id          IS 'Logo analizado (core.empresas_assets).';
COMMENT ON COLUMN core.empresas_identidad_visual.propuesta_algoritmo_version IS 'Versión del algoritmo que generó la propuesta.';
COMMENT ON COLUMN core.empresas_identidad_visual.propuesta_generada_at       IS 'Fecha del último análisis.';
COMMENT ON COLUMN core.empresas_identidad_visual.actualizado_por             IS 'Último usuario que guardó colores (core.usuarios).';
COMMENT ON COLUMN core.empresas_identidad_visual.created_at                  IS 'Fecha de creación del registro.';
COMMENT ON COLUMN core.empresas_identidad_visual.updated_at                  IS 'Última modificación; la actualiza el servicio en cada escritura.';

COMMIT;
