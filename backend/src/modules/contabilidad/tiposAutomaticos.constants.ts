// Catálogo estable de movimientos contables automáticos configurables en
// Contabilidad → Configuración → Tipos automáticos. Las claves deben
// mantenerse en sincronía con frontend/src/types/tiposAutomaticos.ts y con el
// CHECK de contabilidad.configuracion_tipos_automaticos (ver migración
// 20260721_contabilidad_configuracion_tipos_automaticos.sql).
export const CLAVES_MOVIMIENTO_TIPO_AUTOMATICO = [
  // Ventas
  'venta_factura',
  'venta_factura_cancelacion',
  'venta_nota_credito',
  'venta_nota_credito_cancelacion',
  'venta_nota_cargo',
  'venta_nota_cargo_cancelacion',
  // Compras
  'compra_factura',
  'compra_factura_cancelacion',
  'compra_nota_credito',
  'compra_nota_credito_cancelacion',
  'compra_nota_cargo',
  'compra_nota_cargo_cancelacion',
  // Cuentas por cobrar
  'cxc_cobro',
  'cxc_cobro_cancelacion',
  'cxc_anticipo_aplicacion',
  'cxc_anticipo_aplicacion_cancelacion',
  // Cuentas por pagar
  'cxp_pago',
  'cxp_pago_cancelacion',
  'cxp_anticipo_aplicacion',
  'cxp_anticipo_aplicacion_cancelacion',
  // Tesorería / bancos
  'banco_ingreso',
  'banco_ingreso_cancelacion',
  'banco_egreso',
  'banco_egreso_cancelacion',
  'banco_transferencia',
  'banco_transferencia_cancelacion',
  'banco_ajuste_conciliacion',
  'banco_ajuste_conciliacion_cancelacion',
  // Inventarios
  'inventario_entrada',
  'inventario_entrada_cancelacion',
  'inventario_salida',
  'inventario_salida_cancelacion',
  'inventario_traspaso',
  'inventario_traspaso_cancelacion',
  'inventario_ajuste_positivo',
  'inventario_ajuste_positivo_cancelacion',
  'inventario_ajuste_negativo',
  'inventario_ajuste_negativo_cancelacion',
  // Costo de venta / inventario relacionado a documentos
  'costo_venta_factura',
  'costo_venta_factura_cancelacion',
  'inventario_compra_entrada',
  'inventario_compra_entrada_cancelacion',
  // Ajustes contables
  'ajuste_contable_automatico',
  'ajuste_contable_automatico_cancelacion',
  'redondeo',
  'redondeo_cancelacion',
  'diferencia_cambiaria',
  'diferencia_cambiaria_cancelacion',
] as const;

export type ClaveMovimientoTipoAutomatico = (typeof CLAVES_MOVIMIENTO_TIPO_AUTOMATICO)[number];

export const CLAVES_MOVIMIENTO_TIPO_AUTOMATICO_SET: ReadonlySet<string> = new Set(
  CLAVES_MOVIMIENTO_TIPO_AUTOMATICO
);

export function esClaveMovimientoValida(valor: string): valor is ClaveMovimientoTipoAutomatico {
  return CLAVES_MOVIMIENTO_TIPO_AUTOMATICO_SET.has(valor);
}
