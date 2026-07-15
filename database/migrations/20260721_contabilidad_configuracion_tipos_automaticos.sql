-- =========================================================
-- SCRIPT:
-- 20260721_contabilidad_configuracion_tipos_automaticos.sql
--
-- Amplía la configuración de "tipo de póliza automático" (antes limitada a
-- factura de venta y su cancelación, ver 20260720_...) a todos los
-- movimientos contables automáticos posibles del sistema: ventas, compras,
-- cuentas por cobrar, cuentas por pagar, tesorería/bancos, inventarios,
-- costo de venta/inventario relacionado a documentos, y ajustes contables.
--
-- El patrón anterior (una columna bigint por finalidad en
-- contabilidad.configuracion) no escala a ~48 movimientos, así que se migra
-- a una tabla normalizada de tipo clave-valor por empresa. Las columnas
-- tipo_poliza_venta_factura_id / tipo_poliza_venta_cancelacion_id de
-- contabilidad.configuracion NO se eliminan (compatibilidad hacia atrás /
-- rollback), pero dejan de ser la fuente de verdad: se migran sus valores a
-- esta tabla y el motor de contabilización pasa a leer de aquí.
-- =========================================================

BEGIN;

CREATE TABLE contabilidad.configuracion_tipos_automaticos (
  id bigserial PRIMARY KEY,
  empresa_id bigint NOT NULL
    REFERENCES core.empresas(id),
  clave_movimiento varchar(60) NOT NULL
    CHECK (clave_movimiento IN (
      -- Ventas
      'venta_factura', 'venta_factura_cancelacion',
      'venta_nota_credito', 'venta_nota_credito_cancelacion',
      'venta_nota_cargo', 'venta_nota_cargo_cancelacion',
      -- Compras
      'compra_factura', 'compra_factura_cancelacion',
      'compra_nota_credito', 'compra_nota_credito_cancelacion',
      'compra_nota_cargo', 'compra_nota_cargo_cancelacion',
      -- Cuentas por cobrar
      'cxc_cobro', 'cxc_cobro_cancelacion',
      'cxc_anticipo_aplicacion', 'cxc_anticipo_aplicacion_cancelacion',
      -- Cuentas por pagar
      'cxp_pago', 'cxp_pago_cancelacion',
      'cxp_anticipo_aplicacion', 'cxp_anticipo_aplicacion_cancelacion',
      -- Tesorería / bancos
      'banco_ingreso', 'banco_ingreso_cancelacion',
      'banco_egreso', 'banco_egreso_cancelacion',
      'banco_transferencia', 'banco_transferencia_cancelacion',
      'banco_ajuste_conciliacion', 'banco_ajuste_conciliacion_cancelacion',
      -- Inventarios
      'inventario_entrada', 'inventario_entrada_cancelacion',
      'inventario_salida', 'inventario_salida_cancelacion',
      'inventario_traspaso', 'inventario_traspaso_cancelacion',
      'inventario_ajuste_positivo', 'inventario_ajuste_positivo_cancelacion',
      'inventario_ajuste_negativo', 'inventario_ajuste_negativo_cancelacion',
      -- Costo de venta / inventario relacionado a documentos
      'costo_venta_factura', 'costo_venta_factura_cancelacion',
      'inventario_compra_entrada', 'inventario_compra_entrada_cancelacion',
      -- Ajustes contables
      'ajuste_contable_automatico', 'ajuste_contable_automatico_cancelacion',
      'redondeo', 'redondeo_cancelacion',
      'diferencia_cambiaria', 'diferencia_cambiaria_cancelacion'
    )),
  tipo_poliza_id bigint NULL
    REFERENCES contabilidad.tipos_poliza(id),
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_contab_config_tipos_auto_empresa_clave UNIQUE (empresa_id, clave_movimiento)
);

COMMENT ON TABLE contabilidad.configuracion_tipos_automaticos IS
'Tipo de póliza por defecto que debe usar el motor de contabilización automática para cada movimiento contable, por empresa. NULL/ausente = no configurado; el motor debe informar al usuario en vez de contabilizar sin tipo de póliza.';

COMMENT ON COLUMN contabilidad.configuracion_tipos_automaticos.clave_movimiento IS
'Identificador estable del movimiento contable automático (ej. venta_factura, cxc_cobro, inventario_salida_cancelacion). Ver backend/src/modules/contabilidad/tiposAutomaticos.constants.ts para el catálogo completo.';

CREATE INDEX idx_contab_config_tipos_auto_empresa ON contabilidad.configuracion_tipos_automaticos (empresa_id);

COMMENT ON COLUMN contabilidad.configuracion.tipo_poliza_venta_factura_id IS
'DEPRECATED: reemplazada por contabilidad.configuracion_tipos_automaticos (clave_movimiento = ''venta_factura''). Se conserva para no romper compatibilidad; el motor de contabilización ya no la lee.';

COMMENT ON COLUMN contabilidad.configuracion.tipo_poliza_venta_cancelacion_id IS
'DEPRECATED: reemplazada por contabilidad.configuracion_tipos_automaticos (clave_movimiento = ''venta_factura_cancelacion''). Se conserva para no romper compatibilidad; el motor de contabilización ya no la lee.';

-- Migra la configuración ya existente de factura de venta / cancelación
-- (Fase 1) hacia la nueva tabla, para no perder lo que el usuario ya
-- configuró.
INSERT INTO contabilidad.configuracion_tipos_automaticos (empresa_id, clave_movimiento, tipo_poliza_id)
SELECT empresa_id, 'venta_factura', tipo_poliza_venta_factura_id
FROM contabilidad.configuracion
WHERE tipo_poliza_venta_factura_id IS NOT NULL
ON CONFLICT (empresa_id, clave_movimiento) DO NOTHING;

INSERT INTO contabilidad.configuracion_tipos_automaticos (empresa_id, clave_movimiento, tipo_poliza_id)
SELECT empresa_id, 'venta_factura_cancelacion', tipo_poliza_venta_cancelacion_id
FROM contabilidad.configuracion
WHERE tipo_poliza_venta_cancelacion_id IS NOT NULL
ON CONFLICT (empresa_id, clave_movimiento) DO NOTHING;

COMMIT;
