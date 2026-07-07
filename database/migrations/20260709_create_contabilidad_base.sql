-- =========================================================
-- SCRIPT:
-- 20260709_create_contabilidad_base.sql
--
-- Base inicial del módulo de Contabilidad.
-- Migración de diseño desde el modelo contable legado (SQL Server),
-- no como copia literal:
--   - No se migra "Consecutivos"; el siguiente número de póliza
--     se calcula con MAX(numero) + 1 protegido por índice único.
--   - "codigo" de póliza desaparece como campo operativo; se
--     conserva codigo_legacy solo para importación histórica.
--   - Las cuentas usan id bigserial como llave técnica y
--     cuenta varchar(64) como número/código contable visible.
--   - formato_cuenta y formato_descripcion no se almacenan; se
--     calculan en la vista contabilidad.v_cuentas.
--   - "Contabilizaciones" se reemplaza por
--     contabilidad.documentos_polizas, con borrado en cascada
--     hacia el enlace documento-póliza (no hacia el documento).
-- =========================================================

BEGIN;

-- =========================================================
-- ESQUEMA
-- =========================================================

CREATE SCHEMA IF NOT EXISTS contabilidad;

COMMENT ON SCHEMA contabilidad IS 'Schema del módulo de contabilidad de Emphasys ERP.';

-- =========================================================
-- TABLA: contabilidad.configuracion
-- =========================================================

CREATE TABLE contabilidad.configuracion (
  id bigserial PRIMARY KEY,

  empresa_id bigint NOT NULL,

  caracter_separador varchar(1) NOT NULL DEFAULT '-',

  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_contabilidad_configuracion_empresa
    UNIQUE (empresa_id),

  CONSTRAINT fk_contabilidad_configuracion_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES core.empresas(id),

  CONSTRAINT chk_contabilidad_configuracion_caracter_separador
    CHECK (char_length(caracter_separador) = 1)
);

COMMENT ON TABLE contabilidad.configuracion IS 'Configuración general del módulo de contabilidad por empresa.';
COMMENT ON COLUMN contabilidad.configuracion.id IS 'Identificador interno de la configuración contable.';
COMMENT ON COLUMN contabilidad.configuracion.empresa_id IS 'Empresa a la que pertenece la configuración contable.';
COMMENT ON COLUMN contabilidad.configuracion.caracter_separador IS 'Caracter utilizado para separar segmentos visibles de cuentas contables. Puede ser espacio, guion, punto u otro carácter único.';
COMMENT ON COLUMN contabilidad.configuracion.creado_en IS 'Fecha y hora de creación del registro.';
COMMENT ON COLUMN contabilidad.configuracion.actualizado_en IS 'Fecha y hora de la última actualización del registro.';
COMMENT ON CONSTRAINT uq_contabilidad_configuracion_empresa ON contabilidad.configuracion IS 'Evita que una empresa tenga más de una configuración contable.';
COMMENT ON CONSTRAINT fk_contabilidad_configuracion_empresa ON contabilidad.configuracion IS 'Relaciona la configuración contable con su empresa.';
COMMENT ON CONSTRAINT chk_contabilidad_configuracion_caracter_separador ON contabilidad.configuracion IS 'Garantiza que el separador sea exactamente un carácter.';

-- =========================================================
-- TABLA: contabilidad.tipos_poliza
-- =========================================================

CREATE TABLE contabilidad.tipos_poliza (
  id bigserial PRIMARY KEY,

  empresa_id bigint NOT NULL,

  identificador varchar(50) NOT NULL,

  poliza_inicial integer NOT NULL DEFAULT 1,

  activo boolean NOT NULL DEFAULT true,

  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_tipos_poliza_empresa_identificador
    UNIQUE (empresa_id, identificador),

  CONSTRAINT fk_tipos_poliza_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES core.empresas(id)
);

COMMENT ON TABLE contabilidad.tipos_poliza IS 'Catálogo de tipos de póliza contable por empresa.';
COMMENT ON COLUMN contabilidad.tipos_poliza.id IS 'Identificador interno del tipo de póliza.';
COMMENT ON COLUMN contabilidad.tipos_poliza.empresa_id IS 'Empresa a la que pertenece el tipo de póliza.';
COMMENT ON COLUMN contabilidad.tipos_poliza.identificador IS 'Nombre o identificador visible del tipo de póliza, por ejemplo Diario, Ingresos o Egresos.';
COMMENT ON COLUMN contabilidad.tipos_poliza.poliza_inicial IS 'Número inicial sugerido para pólizas de este tipo.';
COMMENT ON COLUMN contabilidad.tipos_poliza.activo IS 'Indica si el tipo de póliza está activo para uso operativo.';
COMMENT ON COLUMN contabilidad.tipos_poliza.creado_en IS 'Fecha y hora de creación del registro.';
COMMENT ON COLUMN contabilidad.tipos_poliza.actualizado_en IS 'Fecha y hora de la última actualización del registro.';
COMMENT ON CONSTRAINT uq_tipos_poliza_empresa_identificador ON contabilidad.tipos_poliza IS 'Evita duplicar identificadores de tipo de póliza dentro de una misma empresa.';
COMMENT ON CONSTRAINT fk_tipos_poliza_empresa ON contabilidad.tipos_poliza IS 'Relaciona el tipo de póliza con su empresa.';

-- =========================================================
-- TABLA: contabilidad.rangos_cuentas
-- =========================================================

CREATE TABLE contabilidad.rangos_cuentas (
  empresa_id bigint NOT NULL,

  id smallint NOT NULL,

  naturaleza_saldo varchar(1) NOT NULL,
  descripcion varchar(80) NOT NULL,
  rango varchar(30),
  grupo varchar(40),
  subgrupo varchar(60),

  activo boolean NOT NULL DEFAULT true,

  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pk_rangos_cuentas
    PRIMARY KEY (empresa_id, id),

  CONSTRAINT fk_rangos_cuentas_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES core.empresas(id),

  CONSTRAINT chk_rangos_cuentas_naturaleza
    CHECK (naturaleza_saldo IN ('D', 'A'))
);

COMMENT ON TABLE contabilidad.rangos_cuentas IS 'Catálogo de rangos o rubros de cuentas contables por empresa.';
COMMENT ON COLUMN contabilidad.rangos_cuentas.empresa_id IS 'Empresa a la que pertenece el rango de cuentas.';
COMMENT ON COLUMN contabilidad.rangos_cuentas.id IS 'Identificador funcional del rango de cuentas dentro de la empresa.';
COMMENT ON COLUMN contabilidad.rangos_cuentas.naturaleza_saldo IS 'Naturaleza normal del saldo del rango: D para deudora, A para acreedora.';
COMMENT ON COLUMN contabilidad.rangos_cuentas.descripcion IS 'Descripción del rango o rubro contable.';
COMMENT ON COLUMN contabilidad.rangos_cuentas.rango IS 'Texto descriptivo del rango de cuentas.';
COMMENT ON COLUMN contabilidad.rangos_cuentas.grupo IS 'Grupo contable al que pertenece el rango.';
COMMENT ON COLUMN contabilidad.rangos_cuentas.subgrupo IS 'Subgrupo contable al que pertenece el rango.';
COMMENT ON COLUMN contabilidad.rangos_cuentas.activo IS 'Indica si el rango está activo.';
COMMENT ON COLUMN contabilidad.rangos_cuentas.creado_en IS 'Fecha y hora de creación del registro.';
COMMENT ON COLUMN contabilidad.rangos_cuentas.actualizado_en IS 'Fecha y hora de la última actualización del registro.';
COMMENT ON CONSTRAINT pk_rangos_cuentas ON contabilidad.rangos_cuentas IS 'Llave primaria compuesta por empresa e identificador de rango.';
COMMENT ON CONSTRAINT fk_rangos_cuentas_empresa ON contabilidad.rangos_cuentas IS 'Relaciona el rango de cuentas con su empresa.';
COMMENT ON CONSTRAINT chk_rangos_cuentas_naturaleza ON contabilidad.rangos_cuentas IS 'Limita la naturaleza del saldo a deudora o acreedora.';

-- =========================================================
-- TABLA: contabilidad.cuentas
-- =========================================================

CREATE TABLE contabilidad.cuentas (
  id bigserial PRIMARY KEY,

  empresa_id bigint NOT NULL,

  cuenta varchar(64) NOT NULL,
  descripcion varchar(200) NOT NULL,

  rango_cuenta_id smallint,
  afectable boolean NOT NULL DEFAULT true,

  cuenta_padre_id bigint,
  nivel smallint NOT NULL DEFAULT 1,

  subgrupo varchar(60),
  codigo_agrupador_sat varchar(10),
  rubro_presupuesto varchar(80),
  no_considerar_presupuesto boolean NOT NULL DEFAULT true,

  observaciones varchar(500),

  activa boolean NOT NULL DEFAULT true,

  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_cuentas_empresa_cuenta
    UNIQUE (empresa_id, cuenta),

  CONSTRAINT fk_cuentas_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES core.empresas(id),

  CONSTRAINT fk_cuentas_rango
    FOREIGN KEY (empresa_id, rango_cuenta_id)
    REFERENCES contabilidad.rangos_cuentas(empresa_id, id),

  CONSTRAINT fk_cuentas_padre
    FOREIGN KEY (cuenta_padre_id)
    REFERENCES contabilidad.cuentas(id),

  CONSTRAINT chk_cuentas_nivel
    CHECK (nivel > 0)
);

COMMENT ON TABLE contabilidad.cuentas IS 'Catálogo de cuentas contables por empresa.';
COMMENT ON COLUMN contabilidad.cuentas.id IS 'Identificador interno de la cuenta contable.';
COMMENT ON COLUMN contabilidad.cuentas.empresa_id IS 'Empresa a la que pertenece la cuenta contable.';
COMMENT ON COLUMN contabilidad.cuentas.cuenta IS 'Número o clave visible de la cuenta contable.';
COMMENT ON COLUMN contabilidad.cuentas.descripcion IS 'Nombre descriptivo de la cuenta contable.';
COMMENT ON COLUMN contabilidad.cuentas.rango_cuenta_id IS 'Rango o rubro contable asociado a la cuenta.';
COMMENT ON COLUMN contabilidad.cuentas.afectable IS 'Indica si la cuenta puede recibir movimientos contables directamente.';
COMMENT ON COLUMN contabilidad.cuentas.cuenta_padre_id IS 'Cuenta contable superior dentro de la jerarquía.';
COMMENT ON COLUMN contabilidad.cuentas.nivel IS 'Nivel jerárquico de la cuenta dentro del catálogo contable.';
COMMENT ON COLUMN contabilidad.cuentas.subgrupo IS 'Subgrupo adicional de clasificación contable.';
COMMENT ON COLUMN contabilidad.cuentas.codigo_agrupador_sat IS 'Código agrupador SAT asociado a la cuenta contable.';
COMMENT ON COLUMN contabilidad.cuentas.rubro_presupuesto IS 'Rubro presupuestal asociado a la cuenta.';
COMMENT ON COLUMN contabilidad.cuentas.no_considerar_presupuesto IS 'Indica si la cuenta debe excluirse de procesos presupuestales.';
COMMENT ON COLUMN contabilidad.cuentas.observaciones IS 'Observaciones internas de la cuenta contable.';
COMMENT ON COLUMN contabilidad.cuentas.activa IS 'Indica si la cuenta está activa para uso operativo.';
COMMENT ON COLUMN contabilidad.cuentas.creado_en IS 'Fecha y hora de creación del registro.';
COMMENT ON COLUMN contabilidad.cuentas.actualizado_en IS 'Fecha y hora de la última actualización del registro.';
COMMENT ON CONSTRAINT uq_cuentas_empresa_cuenta ON contabilidad.cuentas IS 'Evita duplicar números de cuenta dentro de una empresa.';
COMMENT ON CONSTRAINT fk_cuentas_empresa ON contabilidad.cuentas IS 'Relaciona la cuenta contable con su empresa.';
COMMENT ON CONSTRAINT fk_cuentas_rango ON contabilidad.cuentas IS 'Relaciona la cuenta contable con su rango o rubro.';
COMMENT ON CONSTRAINT fk_cuentas_padre ON contabilidad.cuentas IS 'Relaciona una cuenta con su cuenta padre dentro del árbol contable.';
COMMENT ON CONSTRAINT chk_cuentas_nivel ON contabilidad.cuentas IS 'Garantiza que el nivel jerárquico sea mayor que cero.';

-- =========================================================
-- VISTA: contabilidad.v_cuentas
-- =========================================================

CREATE OR REPLACE VIEW contabilidad.v_cuentas AS
SELECT
  c.*,
  regexp_replace(c.cuenta, '(\s+0+)+$', '') AS formato_cuenta,
  repeat('  ', c.nivel - 1) || c.descripcion AS formato_descripcion
FROM contabilidad.cuentas c;

COMMENT ON VIEW contabilidad.v_cuentas IS 'Vista del catálogo contable con campos calculados de presentación para cuenta y descripción.';
COMMENT ON COLUMN contabilidad.v_cuentas.formato_cuenta IS 'Cuenta formateada para visualización, eliminando grupos finales compuestos solo por ceros.';
COMMENT ON COLUMN contabilidad.v_cuentas.formato_descripcion IS 'Descripción formateada para visualización con sangría según el nivel jerárquico.';

-- =========================================================
-- TABLA: contabilidad.cuentas_saldos_mensuales
-- =========================================================

CREATE TABLE contabilidad.cuentas_saldos_mensuales (
  id bigserial PRIMARY KEY,

  empresa_id bigint NOT NULL,
  cuenta_id bigint NOT NULL,

  ejercicio integer NOT NULL,
  periodo smallint NOT NULL,

  cargos numeric(19,2) NOT NULL DEFAULT 0,
  abonos numeric(19,2) NOT NULL DEFAULT 0,

  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_cuentas_saldos_mensuales
    UNIQUE (empresa_id, cuenta_id, ejercicio, periodo),

  CONSTRAINT fk_cuentas_saldos_mensuales_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES core.empresas(id),

  CONSTRAINT fk_cuentas_saldos_mensuales_cuenta
    FOREIGN KEY (cuenta_id)
    REFERENCES contabilidad.cuentas(id),

  CONSTRAINT chk_cuentas_saldos_mensuales_periodo
    CHECK (periodo BETWEEN 1 AND 12),

  CONSTRAINT chk_cuentas_saldos_mensuales_cargos
    CHECK (cargos >= 0),

  CONSTRAINT chk_cuentas_saldos_mensuales_abonos
    CHECK (abonos >= 0)
);

COMMENT ON TABLE contabilidad.cuentas_saldos_mensuales IS 'Acumulados mensuales de cargos y abonos por cuenta contable.';
COMMENT ON COLUMN contabilidad.cuentas_saldos_mensuales.id IS 'Identificador interno del acumulado mensual.';
COMMENT ON COLUMN contabilidad.cuentas_saldos_mensuales.empresa_id IS 'Empresa a la que pertenece el acumulado mensual.';
COMMENT ON COLUMN contabilidad.cuentas_saldos_mensuales.cuenta_id IS 'Cuenta contable a la que pertenece el acumulado.';
COMMENT ON COLUMN contabilidad.cuentas_saldos_mensuales.ejercicio IS 'Ejercicio contable del acumulado.';
COMMENT ON COLUMN contabilidad.cuentas_saldos_mensuales.periodo IS 'Periodo contable mensual del acumulado, del 1 al 12.';
COMMENT ON COLUMN contabilidad.cuentas_saldos_mensuales.cargos IS 'Total de cargos acumulados de la cuenta en el periodo.';
COMMENT ON COLUMN contabilidad.cuentas_saldos_mensuales.abonos IS 'Total de abonos acumulados de la cuenta en el periodo.';
COMMENT ON COLUMN contabilidad.cuentas_saldos_mensuales.creado_en IS 'Fecha y hora de creación del registro.';
COMMENT ON COLUMN contabilidad.cuentas_saldos_mensuales.actualizado_en IS 'Fecha y hora de la última actualización del registro.';
COMMENT ON CONSTRAINT uq_cuentas_saldos_mensuales ON contabilidad.cuentas_saldos_mensuales IS 'Evita duplicar acumulados por empresa, cuenta, ejercicio y periodo.';
COMMENT ON CONSTRAINT fk_cuentas_saldos_mensuales_empresa ON contabilidad.cuentas_saldos_mensuales IS 'Relaciona el acumulado mensual con su empresa.';
COMMENT ON CONSTRAINT fk_cuentas_saldos_mensuales_cuenta ON contabilidad.cuentas_saldos_mensuales IS 'Relaciona el acumulado mensual con su cuenta contable.';
COMMENT ON CONSTRAINT chk_cuentas_saldos_mensuales_periodo ON contabilidad.cuentas_saldos_mensuales IS 'Garantiza que el periodo esté entre 1 y 12.';
COMMENT ON CONSTRAINT chk_cuentas_saldos_mensuales_cargos ON contabilidad.cuentas_saldos_mensuales IS 'Garantiza que los cargos no sean negativos.';
COMMENT ON CONSTRAINT chk_cuentas_saldos_mensuales_abonos ON contabilidad.cuentas_saldos_mensuales IS 'Garantiza que los abonos no sean negativos.';

-- =========================================================
-- TABLA: contabilidad.polizas
-- =========================================================

CREATE TABLE contabilidad.polizas (
  id bigserial PRIMARY KEY,

  empresa_id bigint NOT NULL,

  codigo_legacy varchar(16),

  tipo_poliza_id bigint NOT NULL,

  ejercicio integer NOT NULL,
  periodo smallint NOT NULL,

  numero integer NOT NULL,

  fecha date NOT NULL,

  estatus varchar(20) NOT NULL DEFAULT 'borrador',

  referencia varchar(100),
  observaciones text,

  total_cargos numeric(19,2) NOT NULL DEFAULT 0,
  total_abonos numeric(19,2) NOT NULL DEFAULT 0,

  modulo_origen varchar(30),
  almacen_id bigint,

  uuid_cfdi uuid,

  creada_por_id bigint,
  modificada_por_id bigint,

  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_polizas_empresa_tipo_ejercicio_periodo_numero
    UNIQUE (empresa_id, tipo_poliza_id, ejercicio, periodo, numero),

  CONSTRAINT uq_polizas_empresa_codigo_legacy
    UNIQUE (empresa_id, codigo_legacy),

  CONSTRAINT fk_polizas_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES core.empresas(id),

  CONSTRAINT fk_polizas_tipo
    FOREIGN KEY (tipo_poliza_id)
    REFERENCES contabilidad.tipos_poliza(id),

  CONSTRAINT chk_polizas_periodo
    CHECK (periodo BETWEEN 1 AND 12),

  CONSTRAINT chk_polizas_numero
    CHECK (numero > 0),

  CONSTRAINT chk_polizas_totales
    CHECK (total_cargos >= 0 AND total_abonos >= 0),

  CONSTRAINT chk_polizas_estatus
    CHECK (estatus IN ('borrador', 'aplicada', 'cancelada'))
);

COMMENT ON TABLE contabilidad.polizas IS 'Encabezado de pólizas contables.';
COMMENT ON COLUMN contabilidad.polizas.id IS 'Identificador interno de la póliza contable.';
COMMENT ON COLUMN contabilidad.polizas.empresa_id IS 'Empresa a la que pertenece la póliza.';
COMMENT ON COLUMN contabilidad.polizas.codigo_legacy IS 'Código de póliza heredado del sistema anterior, usado solo para importación o auditoría histórica.';
COMMENT ON COLUMN contabilidad.polizas.tipo_poliza_id IS 'Tipo de póliza contable.';
COMMENT ON COLUMN contabilidad.polizas.ejercicio IS 'Ejercicio contable de la póliza.';
COMMENT ON COLUMN contabilidad.polizas.periodo IS 'Periodo contable mensual de la póliza, del 1 al 12.';
COMMENT ON COLUMN contabilidad.polizas.numero IS 'Número consecutivo de la póliza dentro de empresa, tipo, ejercicio y periodo.';
COMMENT ON COLUMN contabilidad.polizas.fecha IS 'Fecha contable de la póliza.';
COMMENT ON COLUMN contabilidad.polizas.estatus IS 'Estatus operativo de la póliza: borrador, aplicada o cancelada.';
COMMENT ON COLUMN contabilidad.polizas.referencia IS 'Referencia externa o interna de la póliza.';
COMMENT ON COLUMN contabilidad.polizas.observaciones IS 'Observaciones libres de la póliza.';
COMMENT ON COLUMN contabilidad.polizas.total_cargos IS 'Total de cargos de la póliza.';
COMMENT ON COLUMN contabilidad.polizas.total_abonos IS 'Total de abonos de la póliza.';
COMMENT ON COLUMN contabilidad.polizas.modulo_origen IS 'Módulo que generó la póliza, cuando aplique.';
COMMENT ON COLUMN contabilidad.polizas.almacen_id IS 'Almacén relacionado con la póliza, cuando aplique.';
COMMENT ON COLUMN contabilidad.polizas.uuid_cfdi IS 'UUID fiscal relacionado con la póliza, cuando aplique.';
COMMENT ON COLUMN contabilidad.polizas.creada_por_id IS 'Usuario que creó la póliza.';
COMMENT ON COLUMN contabilidad.polizas.modificada_por_id IS 'Usuario que modificó por última vez la póliza.';
COMMENT ON COLUMN contabilidad.polizas.creado_en IS 'Fecha y hora de creación del registro.';
COMMENT ON COLUMN contabilidad.polizas.actualizado_en IS 'Fecha y hora de la última actualización del registro.';
COMMENT ON CONSTRAINT uq_polizas_empresa_tipo_ejercicio_periodo_numero ON contabilidad.polizas IS 'Evita duplicar números de póliza por empresa, tipo, ejercicio y periodo.';
COMMENT ON CONSTRAINT uq_polizas_empresa_codigo_legacy ON contabilidad.polizas IS 'Evita duplicar códigos heredados de póliza por empresa durante la importación histórica.';
COMMENT ON CONSTRAINT fk_polizas_empresa ON contabilidad.polizas IS 'Relaciona la póliza con su empresa.';
COMMENT ON CONSTRAINT fk_polizas_tipo ON contabilidad.polizas IS 'Relaciona la póliza con su tipo de póliza.';
COMMENT ON CONSTRAINT chk_polizas_periodo ON contabilidad.polizas IS 'Garantiza que el periodo esté entre 1 y 12.';
COMMENT ON CONSTRAINT chk_polizas_numero ON contabilidad.polizas IS 'Garantiza que el número de póliza sea mayor que cero.';
COMMENT ON CONSTRAINT chk_polizas_totales ON contabilidad.polizas IS 'Garantiza que los totales de cargos y abonos no sean negativos.';
COMMENT ON CONSTRAINT chk_polizas_estatus ON contabilidad.polizas IS 'Limita los estatus permitidos de la póliza.';

-- =========================================================
-- TABLA: contabilidad.polizas_detalle
-- =========================================================

CREATE TABLE contabilidad.polizas_detalle (
  id bigserial PRIMARY KEY,

  empresa_id bigint NOT NULL,
  poliza_id bigint NOT NULL,

  renglon integer NOT NULL,

  cuenta_id bigint NOT NULL,
  concepto_id bigint,

  cargo numeric(19,2) NOT NULL DEFAULT 0,
  abono numeric(19,2) NOT NULL DEFAULT 0,

  fecha date,

  uuid_cfdi uuid,
  rfc varchar(13),

  cuenta_legacy varchar(64),

  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_polizas_detalle_poliza_renglon
    UNIQUE (poliza_id, renglon),

  CONSTRAINT fk_polizas_detalle_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES core.empresas(id),

  CONSTRAINT fk_polizas_detalle_poliza
    FOREIGN KEY (poliza_id)
    REFERENCES contabilidad.polizas(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_polizas_detalle_cuenta
    FOREIGN KEY (cuenta_id)
    REFERENCES contabilidad.cuentas(id),

  CONSTRAINT fk_polizas_detalle_concepto
    FOREIGN KEY (concepto_id)
    REFERENCES public.conceptos(id),

  CONSTRAINT chk_polizas_detalle_importes
    CHECK (cargo >= 0 AND abono >= 0),

  CONSTRAINT chk_polizas_detalle_cargo_o_abono
    CHECK (
      (cargo > 0 AND abono = 0)
      OR
      (cargo = 0 AND abono > 0)
    )
);

COMMENT ON TABLE contabilidad.polizas_detalle IS 'Detalle de movimientos contables de cada póliza.';
COMMENT ON COLUMN contabilidad.polizas_detalle.id IS 'Identificador interno del movimiento contable.';
COMMENT ON COLUMN contabilidad.polizas_detalle.empresa_id IS 'Empresa a la que pertenece el movimiento contable.';
COMMENT ON COLUMN contabilidad.polizas_detalle.poliza_id IS 'Póliza a la que pertenece el movimiento contable.';
COMMENT ON COLUMN contabilidad.polizas_detalle.renglon IS 'Número de renglón o partida dentro de la póliza.';
COMMENT ON COLUMN contabilidad.polizas_detalle.cuenta_id IS 'Cuenta contable afectada por el movimiento.';
COMMENT ON COLUMN contabilidad.polizas_detalle.concepto_id IS 'Concepto asociado al movimiento contable. Puede ser nulo.';
COMMENT ON COLUMN contabilidad.polizas_detalle.cargo IS 'Importe cargado en la cuenta contable.';
COMMENT ON COLUMN contabilidad.polizas_detalle.abono IS 'Importe abonado en la cuenta contable.';
COMMENT ON COLUMN contabilidad.polizas_detalle.fecha IS 'Fecha del movimiento contable, cuando difiera o se requiera a nivel partida.';
COMMENT ON COLUMN contabilidad.polizas_detalle.uuid_cfdi IS 'UUID fiscal relacionado con el movimiento contable, cuando aplique.';
COMMENT ON COLUMN contabilidad.polizas_detalle.rfc IS 'RFC relacionado con el movimiento contable, cuando aplique.';
COMMENT ON COLUMN contabilidad.polizas_detalle.cuenta_legacy IS 'Cuenta heredada del sistema anterior, usada para importación o auditoría histórica.';
COMMENT ON COLUMN contabilidad.polizas_detalle.creado_en IS 'Fecha y hora de creación del registro.';
COMMENT ON COLUMN contabilidad.polizas_detalle.actualizado_en IS 'Fecha y hora de la última actualización del registro.';
COMMENT ON CONSTRAINT uq_polizas_detalle_poliza_renglon ON contabilidad.polizas_detalle IS 'Evita duplicar renglones dentro de una misma póliza.';
COMMENT ON CONSTRAINT fk_polizas_detalle_empresa ON contabilidad.polizas_detalle IS 'Relaciona el movimiento contable con su empresa.';
COMMENT ON CONSTRAINT fk_polizas_detalle_poliza ON contabilidad.polizas_detalle IS 'Relaciona el movimiento contable con su póliza y lo elimina si se borra la póliza.';
COMMENT ON CONSTRAINT fk_polizas_detalle_cuenta ON contabilidad.polizas_detalle IS 'Relaciona el movimiento contable con la cuenta afectada.';
COMMENT ON CONSTRAINT fk_polizas_detalle_concepto ON contabilidad.polizas_detalle IS 'Relaciona el movimiento contable con el catálogo general de conceptos.';
COMMENT ON CONSTRAINT chk_polizas_detalle_importes ON contabilidad.polizas_detalle IS 'Garantiza que cargo y abono no sean negativos.';
COMMENT ON CONSTRAINT chk_polizas_detalle_cargo_o_abono ON contabilidad.polizas_detalle IS 'Garantiza que cada movimiento tenga cargo o abono, pero no ambos.';

-- =========================================================
-- TABLA: contabilidad.documentos_polizas
-- =========================================================

CREATE TABLE contabilidad.documentos_polizas (
  id bigserial PRIMARY KEY,

  empresa_id bigint NOT NULL,

  documento_id bigint NOT NULL,
  poliza_id bigint NOT NULL,

  tipo varchar(20) NOT NULL DEFAULT 'original',

  documento_poliza_original_id bigint,

  codigo_poliza_legacy varchar(16),

  creado_en timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_documentos_polizas_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES core.empresas(id),

  CONSTRAINT fk_documentos_polizas_documento
    FOREIGN KEY (documento_id)
    REFERENCES public.documentos(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_documentos_polizas_poliza
    FOREIGN KEY (poliza_id)
    REFERENCES contabilidad.polizas(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_documentos_polizas_original
    FOREIGN KEY (documento_poliza_original_id)
    REFERENCES contabilidad.documentos_polizas(id),

  CONSTRAINT chk_documentos_polizas_tipo
    CHECK (tipo IN ('original', 'cancelacion', 'reversa', 'ajuste'))
);

COMMENT ON TABLE contabilidad.documentos_polizas IS 'Relación entre documentos operativos del ERP y las pólizas contables generadas.';
COMMENT ON COLUMN contabilidad.documentos_polizas.id IS 'Identificador interno de la relación entre documento y póliza.';
COMMENT ON COLUMN contabilidad.documentos_polizas.empresa_id IS 'Empresa a la que pertenece la relación.';
COMMENT ON COLUMN contabilidad.documentos_polizas.documento_id IS 'Documento operativo relacionado con la póliza.';
COMMENT ON COLUMN contabilidad.documentos_polizas.poliza_id IS 'Póliza contable relacionada con el documento.';
COMMENT ON COLUMN contabilidad.documentos_polizas.tipo IS 'Tipo de relación entre documento y póliza: original, cancelacion, reversa o ajuste.';
COMMENT ON COLUMN contabilidad.documentos_polizas.documento_poliza_original_id IS 'Relación original asociada cuando este registro corresponde a una cancelación, reversa o ajuste.';
COMMENT ON COLUMN contabilidad.documentos_polizas.codigo_poliza_legacy IS 'Código de póliza heredado del sistema anterior, usado para importación o auditoría histórica.';
COMMENT ON COLUMN contabilidad.documentos_polizas.creado_en IS 'Fecha y hora de creación del registro.';
COMMENT ON CONSTRAINT fk_documentos_polizas_empresa ON contabilidad.documentos_polizas IS 'Relaciona la relación documento-póliza con su empresa.';
COMMENT ON CONSTRAINT fk_documentos_polizas_documento ON contabilidad.documentos_polizas IS 'Relaciona la póliza con el documento operativo y elimina el enlace si se borra el documento.';
COMMENT ON CONSTRAINT fk_documentos_polizas_poliza ON contabilidad.documentos_polizas IS 'Relaciona el documento con la póliza y elimina el enlace si se borra la póliza.';
COMMENT ON CONSTRAINT fk_documentos_polizas_original ON contabilidad.documentos_polizas IS 'Permite ligar una póliza de cancelación, reversa o ajuste con la relación original.';
COMMENT ON CONSTRAINT chk_documentos_polizas_tipo ON contabilidad.documentos_polizas IS 'Limita los tipos permitidos de relación entre documento y póliza.';

-- =========================================================
-- ÍNDICES: contabilidad.documentos_polizas
-- =========================================================

CREATE INDEX idx_documentos_polizas_documento
ON contabilidad.documentos_polizas (documento_id);

COMMENT ON INDEX contabilidad.idx_documentos_polizas_documento IS 'Índice para consultar pólizas relacionadas a un documento operativo.';

CREATE INDEX idx_documentos_polizas_poliza
ON contabilidad.documentos_polizas (poliza_id);

COMMENT ON INDEX contabilidad.idx_documentos_polizas_poliza IS 'Índice para consultar documentos relacionados a una póliza contable.';

CREATE INDEX idx_documentos_polizas_empresa_documento_tipo
ON contabilidad.documentos_polizas (empresa_id, documento_id, tipo);

COMMENT ON INDEX contabilidad.idx_documentos_polizas_empresa_documento_tipo IS 'Índice para determinar rápidamente si un documento de una empresa tiene póliza original, cancelación, reversa o ajuste.';

CREATE UNIQUE INDEX uq_documentos_polizas_documento_poliza_tipo
ON contabilidad.documentos_polizas (documento_id, poliza_id, tipo);

COMMENT ON INDEX contabilidad.uq_documentos_polizas_documento_poliza_tipo IS 'Evita duplicar una misma relación entre documento, póliza y tipo.';

COMMIT;
