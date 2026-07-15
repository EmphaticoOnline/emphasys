// Catálogo estable de movimientos contables automáticos configurables en
// Contabilidad → Configuración → Tipos automáticos. Debe mantenerse en
// sincronía con backend/src/modules/contabilidad/tiposAutomaticos.constants.ts.
export type ClaveMovimientoTipoAutomatico =
  | 'venta_factura'
  | 'venta_factura_cancelacion'
  | 'venta_nota_credito'
  | 'venta_nota_credito_cancelacion'
  | 'venta_nota_cargo'
  | 'venta_nota_cargo_cancelacion'
  | 'compra_factura'
  | 'compra_factura_cancelacion'
  | 'compra_nota_credito'
  | 'compra_nota_credito_cancelacion'
  | 'compra_nota_cargo'
  | 'compra_nota_cargo_cancelacion'
  | 'cxc_cobro'
  | 'cxc_cobro_cancelacion'
  | 'cxc_anticipo_aplicacion'
  | 'cxc_anticipo_aplicacion_cancelacion'
  | 'cxp_pago'
  | 'cxp_pago_cancelacion'
  | 'cxp_anticipo_aplicacion'
  | 'cxp_anticipo_aplicacion_cancelacion'
  | 'banco_ingreso'
  | 'banco_ingreso_cancelacion'
  | 'banco_egreso'
  | 'banco_egreso_cancelacion'
  | 'banco_transferencia'
  | 'banco_transferencia_cancelacion'
  | 'banco_ajuste_conciliacion'
  | 'banco_ajuste_conciliacion_cancelacion'
  | 'inventario_entrada'
  | 'inventario_entrada_cancelacion'
  | 'inventario_salida'
  | 'inventario_salida_cancelacion'
  | 'inventario_traspaso'
  | 'inventario_traspaso_cancelacion'
  | 'inventario_ajuste_positivo'
  | 'inventario_ajuste_positivo_cancelacion'
  | 'inventario_ajuste_negativo'
  | 'inventario_ajuste_negativo_cancelacion'
  | 'costo_venta_factura'
  | 'costo_venta_factura_cancelacion'
  | 'inventario_compra_entrada'
  | 'inventario_compra_entrada_cancelacion'
  | 'ajuste_contable_automatico'
  | 'ajuste_contable_automatico_cancelacion'
  | 'redondeo'
  | 'redondeo_cancelacion'
  | 'diferencia_cambiaria'
  | 'diferencia_cambiaria_cancelacion';

export interface ConfiguracionTipoAutomatico {
  clave_movimiento: ClaveMovimientoTipoAutomatico;
  tipo_poliza_id: number | null;
}

export interface ActualizarTipoAutomaticoInput {
  clave_movimiento: ClaveMovimientoTipoAutomatico;
  tipo_poliza_id: number | null;
}

export interface CampoTipoAutomatico {
  clave: ClaveMovimientoTipoAutomatico;
  etiqueta: string;
  esCancelacion?: boolean;
}

export interface SeccionTiposAutomaticos {
  titulo: string;
  descripcion?: string;
  campos: CampoTipoAutomatico[];
}

export const SECCIONES_TIPOS_AUTOMATICOS: SeccionTiposAutomaticos[] = [
  {
    titulo: 'Ventas',
    campos: [
      { clave: 'venta_factura', etiqueta: 'Factura de venta' },
      { clave: 'venta_factura_cancelacion', etiqueta: 'Cancelación de factura de venta', esCancelacion: true },
      { clave: 'venta_nota_credito', etiqueta: 'Nota de crédito de cliente' },
      {
        clave: 'venta_nota_credito_cancelacion',
        etiqueta: 'Cancelación de nota de crédito de cliente',
        esCancelacion: true,
      },
      { clave: 'venta_nota_cargo', etiqueta: 'Nota de cargo de cliente' },
      {
        clave: 'venta_nota_cargo_cancelacion',
        etiqueta: 'Cancelación de nota de cargo de cliente',
        esCancelacion: true,
      },
    ],
  },
  {
    titulo: 'Compras',
    campos: [
      { clave: 'compra_factura', etiqueta: 'Factura de compra' },
      { clave: 'compra_factura_cancelacion', etiqueta: 'Cancelación de factura de compra', esCancelacion: true },
      { clave: 'compra_nota_credito', etiqueta: 'Nota de crédito de proveedor' },
      {
        clave: 'compra_nota_credito_cancelacion',
        etiqueta: 'Cancelación de nota de crédito de proveedor',
        esCancelacion: true,
      },
      { clave: 'compra_nota_cargo', etiqueta: 'Nota de cargo de proveedor' },
      {
        clave: 'compra_nota_cargo_cancelacion',
        etiqueta: 'Cancelación de nota de cargo de proveedor',
        esCancelacion: true,
      },
    ],
  },
  {
    titulo: 'Cuentas por cobrar',
    campos: [
      { clave: 'cxc_cobro', etiqueta: 'Cobro de cliente' },
      { clave: 'cxc_cobro_cancelacion', etiqueta: 'Cancelación de cobro de cliente', esCancelacion: true },
      { clave: 'cxc_anticipo_aplicacion', etiqueta: 'Aplicación de anticipo de cliente' },
      {
        clave: 'cxc_anticipo_aplicacion_cancelacion',
        etiqueta: 'Cancelación de aplicación de anticipo de cliente',
        esCancelacion: true,
      },
    ],
  },
  {
    titulo: 'Cuentas por pagar',
    campos: [
      { clave: 'cxp_pago', etiqueta: 'Pago a proveedor' },
      { clave: 'cxp_pago_cancelacion', etiqueta: 'Cancelación de pago a proveedor', esCancelacion: true },
      { clave: 'cxp_anticipo_aplicacion', etiqueta: 'Aplicación de anticipo a proveedor' },
      {
        clave: 'cxp_anticipo_aplicacion_cancelacion',
        etiqueta: 'Cancelación de aplicación de anticipo a proveedor',
        esCancelacion: true,
      },
    ],
  },
  {
    titulo: 'Tesorería / Bancos',
    campos: [
      { clave: 'banco_ingreso', etiqueta: 'Ingreso bancario' },
      { clave: 'banco_ingreso_cancelacion', etiqueta: 'Cancelación de ingreso bancario', esCancelacion: true },
      { clave: 'banco_egreso', etiqueta: 'Egreso bancario' },
      { clave: 'banco_egreso_cancelacion', etiqueta: 'Cancelación de egreso bancario', esCancelacion: true },
      { clave: 'banco_transferencia', etiqueta: 'Transferencia entre cuentas' },
      {
        clave: 'banco_transferencia_cancelacion',
        etiqueta: 'Cancelación de transferencia entre cuentas',
        esCancelacion: true,
      },
      { clave: 'banco_ajuste_conciliacion', etiqueta: 'Conciliación bancaria / ajuste de conciliación' },
      {
        clave: 'banco_ajuste_conciliacion_cancelacion',
        etiqueta: 'Cancelación de ajuste de conciliación',
        esCancelacion: true,
      },
    ],
  },
  {
    titulo: 'Inventarios',
    campos: [
      { clave: 'inventario_entrada', etiqueta: 'Entrada de inventario' },
      { clave: 'inventario_entrada_cancelacion', etiqueta: 'Cancelación de entrada de inventario', esCancelacion: true },
      { clave: 'inventario_salida', etiqueta: 'Salida de inventario' },
      { clave: 'inventario_salida_cancelacion', etiqueta: 'Cancelación de salida de inventario', esCancelacion: true },
      { clave: 'inventario_traspaso', etiqueta: 'Traspaso entre almacenes' },
      {
        clave: 'inventario_traspaso_cancelacion',
        etiqueta: 'Cancelación de traspaso entre almacenes',
        esCancelacion: true,
      },
      { clave: 'inventario_ajuste_positivo', etiqueta: 'Ajuste positivo de inventario' },
      {
        clave: 'inventario_ajuste_positivo_cancelacion',
        etiqueta: 'Cancelación de ajuste positivo de inventario',
        esCancelacion: true,
      },
      { clave: 'inventario_ajuste_negativo', etiqueta: 'Ajuste negativo de inventario' },
      {
        clave: 'inventario_ajuste_negativo_cancelacion',
        etiqueta: 'Cancelación de ajuste negativo de inventario',
        esCancelacion: true,
      },
    ],
  },
  {
    titulo: 'Costo de venta e inventario por documentos',
    descripcion: 'La factura y su movimiento de inventario relacionado son pólizas distintas: no se mezclan.',
    campos: [
      { clave: 'costo_venta_factura', etiqueta: 'Costo de venta por factura' },
      {
        clave: 'costo_venta_factura_cancelacion',
        etiqueta: 'Cancelación de costo de venta por factura',
        esCancelacion: true,
      },
      { clave: 'inventario_compra_entrada', etiqueta: 'Entrada a inventario por compra' },
      {
        clave: 'inventario_compra_entrada_cancelacion',
        etiqueta: 'Cancelación de entrada a inventario por compra',
        esCancelacion: true,
      },
    ],
  },
  {
    titulo: 'Ajustes contables',
    campos: [
      { clave: 'ajuste_contable_automatico', etiqueta: 'Ajuste contable automático' },
      {
        clave: 'ajuste_contable_automatico_cancelacion',
        etiqueta: 'Cancelación de ajuste contable automático',
        esCancelacion: true,
      },
      { clave: 'redondeo', etiqueta: 'Póliza de redondeo' },
      { clave: 'redondeo_cancelacion', etiqueta: 'Cancelación de póliza de redondeo', esCancelacion: true },
      { clave: 'diferencia_cambiaria', etiqueta: 'Diferencia cambiaria' },
      {
        clave: 'diferencia_cambiaria_cancelacion',
        etiqueta: 'Cancelación de diferencia cambiaria',
        esCancelacion: true,
      },
    ],
  },
];
