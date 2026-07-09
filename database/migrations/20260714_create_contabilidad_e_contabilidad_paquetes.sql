-- =========================================================
-- SCRIPT:
-- 20260714_create_contabilidad_e_contabilidad_paquetes.sql
--
-- Fase 12 de e-contabilidad: bitácora interna de paquetes ZIP generados
-- (Catálogo/Balanza/Pólizas/Auxiliares agrupados, ver Fase 11 - Paquete
-- ZIP). Registra QUÉ se generó, CUÁNDO, CON QUÉ PARÁMETROS y el HASH del
-- ZIP resultante -- no guarda el archivo binario (ni el ZIP ni los XML
-- individuales): es trazabilidad, no almacenamiento documental. Un mismo
-- ejercicio/periodo puede generarse varias veces (regenerar el paquete no
-- está prohibido); por eso NO hay UNIQUE sobre empresa/ejercicio/periodo,
-- cada descarga exitosa agrega un renglón nuevo.
--
-- Los campos enviado_sat/enviado_sat_en/acuse_sat y estatus quedan
-- PREPARADOS para una fase futura de envío real al SAT, pero esta fase NO
-- los usa más allá del valor por defecto ('generado' / false): no hay
-- envío, firma ni sello todavía.
-- =========================================================

BEGIN;

CREATE TABLE contabilidad.e_contabilidad_paquetes (
  id bigserial PRIMARY KEY,

  empresa_id bigint NOT NULL,
  ejercicio integer NOT NULL,
  periodo smallint NOT NULL,

  nombre_zip varchar(255) NOT NULL,
  archivos_incluidos jsonb NOT NULL,
  parametros jsonb NOT NULL,
  resumen jsonb NOT NULL,

  hash_zip varchar(128),
  hash_algoritmo varchar(20) DEFAULT 'SHA-256',

  generado_por bigint,
  generado_en timestamptz NOT NULL DEFAULT now(),
  observaciones text,

  -- Preparado para una fase futura de envío al SAT; no usado todavía.
  estatus varchar(30) NOT NULL DEFAULT 'generado',
  enviado_sat boolean NOT NULL DEFAULT false,
  enviado_sat_en timestamptz,
  acuse_sat text,

  CONSTRAINT fk_e_contabilidad_paquetes_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES core.empresas(id),

  CONSTRAINT chk_e_contabilidad_paquetes_ejercicio
    CHECK (ejercicio >= 2000),

  CONSTRAINT chk_e_contabilidad_paquetes_periodo
    CHECK (periodo BETWEEN 1 AND 12),

  CONSTRAINT chk_e_contabilidad_paquetes_estatus
    CHECK (estatus IN ('generado', 'enviado', 'aceptado', 'rechazado'))
);

COMMENT ON TABLE contabilidad.e_contabilidad_paquetes IS 'Bitácora interna de paquetes ZIP de e-contabilidad generados/descargados (Catálogo, Balanza, Pólizas, Auxiliares). Registra trazabilidad (parámetros, archivos incluidos, resumen, hash) pero NO almacena el ZIP ni los XML; cada descarga exitosa agrega un renglón nuevo, sin límite de regeneraciones por ejercicio/periodo.';
COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.id IS 'Identificador interno del registro de bitácora.';
COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.empresa_id IS 'Empresa para la que se generó el paquete.';
COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.ejercicio IS 'Ejercicio contable del paquete generado.';
COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.periodo IS 'Periodo (mes, 1-12) del paquete generado.';
COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.nombre_zip IS 'Nombre del archivo ZIP generado (convención RFC+Año+Mes+"_econtabilidad.zip").';
COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.archivos_incluidos IS 'Arreglo JSON con los archivos incluidos en el paquete: clave, título, nombre de archivo XML, ok, errores y advertencias por archivo (mismo detalle que expone el preview del paquete).';
COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.parametros IS 'Parámetros usados para generar el paquete: ejercicio, periodo, qué XML se incluyeron, TipoEnvio/FechaModBal de Balanza si aplica, TipoSolicitud/NumOrden/NumTramite si aplica.';
COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.resumen IS 'Resumen agregado del paquete al momento de generarse: archivos seleccionados, correctos, con error, total de errores y advertencias.';
COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.hash_zip IS 'Hash del buffer ZIP generado (hexadecimal), para detectar si una regeneración produjo un archivo idéntico o distinto.';
COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.hash_algoritmo IS 'Algoritmo usado para hash_zip (por ahora siempre SHA-256).';
COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.generado_por IS 'Usuario que generó/descargó el paquete (sin FK a core.usuarios, mismo criterio que contabilidad.polizas.creada_por_id).';
COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.generado_en IS 'Fecha y hora en que se generó/descargó el paquete.';
COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.observaciones IS 'Notas libres sobre el paquete generado (uso futuro; no capturadas desde la pantalla en esta fase).';
COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.estatus IS 'Estatus del paquete respecto a un futuro envío al SAT. En esta fase siempre queda en ''generado''.';
COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.enviado_sat IS 'Preparado para una fase futura de envío al SAT; no usado todavía (siempre false).';
COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.enviado_sat_en IS 'Preparado para una fase futura de envío al SAT; no usado todavía.';
COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.acuse_sat IS 'Preparado para una fase futura de envío al SAT (acuse de recepción); no usado todavía.';
COMMENT ON CONSTRAINT fk_e_contabilidad_paquetes_empresa ON contabilidad.e_contabilidad_paquetes IS 'Relaciona el paquete generado con su empresa.';
COMMENT ON CONSTRAINT chk_e_contabilidad_paquetes_ejercicio ON contabilidad.e_contabilidad_paquetes IS 'Descarta ejercicios claramente inválidos (antes del año 2000).';
COMMENT ON CONSTRAINT chk_e_contabilidad_paquetes_periodo ON contabilidad.e_contabilidad_paquetes IS 'El periodo debe ser un mes válido (1-12).';
COMMENT ON CONSTRAINT chk_e_contabilidad_paquetes_estatus ON contabilidad.e_contabilidad_paquetes IS 'Limita el estatus a los valores reconocidos por el sistema.';

CREATE INDEX idx_e_contabilidad_paquetes_empresa_ejercicio_periodo
ON contabilidad.e_contabilidad_paquetes (empresa_id, ejercicio, periodo);

COMMENT ON INDEX contabilidad.idx_e_contabilidad_paquetes_empresa_ejercicio_periodo IS 'Índice para consultar la bitácora de una empresa filtrando por ejercicio/periodo.';

CREATE INDEX idx_e_contabilidad_paquetes_generado_en
ON contabilidad.e_contabilidad_paquetes (generado_en DESC);

COMMENT ON INDEX contabilidad.idx_e_contabilidad_paquetes_generado_en IS 'Índice para listar la bitácora ordenada por fecha de generación más reciente.';

COMMIT;
