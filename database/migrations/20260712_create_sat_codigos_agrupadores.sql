-- =========================================================
-- SCRIPT:
-- 20260712_create_sat_codigos_agrupadores.sql
--
-- Catálogo oficial de códigos agrupadores de cuentas (Anexo 24,
-- Contabilidad Electrónica). Fase 2 de e-contabilidad: crea SOLO la
-- estructura de la tabla, sin cargar datos.
--
-- El catálogo oficial (código, descripción, nivel, naturaleza) no está
-- disponible en este repositorio ni en los catálogos SAT ya cargados
-- localmente (se revisaron los archivos existentes en
-- OneDrive/Emphasys/SAT/Catalogos: solo contienen catálogos de CFDI
-- -productos/servicios, formas de pago, etc.-, no el catálogo de
-- códigos agrupadores de contabilidad electrónica). Cargar el catálogo
-- real es un paso manual posterior: ver
-- database/scripts/reimport_sat_codigos_agrupadores.sql.
--
-- Mientras la tabla esté vacía, el validador de e-contabilidad
-- (contabilidad.eContabilidad) reporta explícitamente que el catálogo
-- no está cargado, en vez de asumir que todos los códigos capturados
-- son válidos.
-- =========================================================

BEGIN;

CREATE TABLE sat.codigos_agrupadores (
  id bigserial PRIMARY KEY,

  codigo varchar(20) NOT NULL,
  descripcion varchar(300) NOT NULL,

  nivel smallint,
  naturaleza varchar(1),

  activo boolean NOT NULL DEFAULT true,

  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_codigos_agrupadores_codigo
    UNIQUE (codigo),

  CONSTRAINT chk_codigos_agrupadores_naturaleza
    CHECK (naturaleza IS NULL OR naturaleza IN ('D', 'A')),

  CONSTRAINT chk_codigos_agrupadores_nivel
    CHECK (nivel IS NULL OR nivel > 0)
);

COMMENT ON TABLE sat.codigos_agrupadores IS 'Catálogo oficial de códigos agrupadores de cuentas del Anexo 24 (Contabilidad Electrónica). Se usa para validar contabilidad.cuentas.codigo_agrupador_sat.';
COMMENT ON COLUMN sat.codigos_agrupadores.id IS 'Identificador interno del código agrupador.';
COMMENT ON COLUMN sat.codigos_agrupadores.codigo IS 'Código agrupador tal como lo publica el SAT (ej. 102.01), usado para correlacionar con contabilidad.cuentas.codigo_agrupador_sat.';
COMMENT ON COLUMN sat.codigos_agrupadores.descripcion IS 'Descripción oficial del código agrupador.';
COMMENT ON COLUMN sat.codigos_agrupadores.nivel IS 'Nivel jerárquico del código agrupador dentro del catálogo oficial, cuando el catálogo lo distingue.';
COMMENT ON COLUMN sat.codigos_agrupadores.naturaleza IS 'Naturaleza esperada del código agrupador: D (deudora) o A (acreedora), cuando el catálogo lo distingue.';
COMMENT ON COLUMN sat.codigos_agrupadores.activo IS 'Indica si el código sigue vigente en el catálogo oficial. Un código dado de baja no debe usarse en cuentas nuevas, pero se conserva para no romper históricos.';
COMMENT ON COLUMN sat.codigos_agrupadores.creado_en IS 'Fecha y hora de creación del registro.';
COMMENT ON COLUMN sat.codigos_agrupadores.actualizado_en IS 'Fecha y hora de la última actualización del registro.';
COMMENT ON CONSTRAINT uq_codigos_agrupadores_codigo ON sat.codigos_agrupadores IS 'Evita duplicar códigos agrupadores en el catálogo.';
COMMENT ON CONSTRAINT chk_codigos_agrupadores_naturaleza ON sat.codigos_agrupadores IS 'Limita la naturaleza a Deudora o Acreedora cuando se captura.';
COMMENT ON CONSTRAINT chk_codigos_agrupadores_nivel ON sat.codigos_agrupadores IS 'Garantiza que el nivel, cuando se captura, sea mayor que cero.';

COMMIT;
