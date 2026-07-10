export const USOS_CONTABLES = [
  'cliente_cxc',
  'proveedor_cxp',
  'banco_caja',
  'concepto_tesoreria',
  'venta_producto',
  'compra_producto',
  'inventario_almacen',
  'costo_ventas',
  'ajuste_inventario_positivo',
  'ajuste_inventario_negativo',
  'merma_inventario',
  'traspaso_inventario',
  'iva_trasladado',
  'iva_acreditable',
  'retencion_iva',
  'retencion_isr',
  'ieps',
  'impuesto_otro',
] as const;

export type UsoContable = (typeof USOS_CONTABLES)[number];

export const USO_CONTABLE_LABELS: Record<UsoContable, string> = {
  cliente_cxc: 'Cliente (CxC)',
  proveedor_cxp: 'Proveedor (CxP)',
  banco_caja: 'Banco / Caja',
  concepto_tesoreria: 'Concepto de tesorería',
  venta_producto: 'Venta de producto',
  compra_producto: 'Compra de producto',
  inventario_almacen: 'Inventario de almacén',
  costo_ventas: 'Costo de ventas',
  ajuste_inventario_positivo: 'Ajuste de inventario (positivo)',
  ajuste_inventario_negativo: 'Ajuste de inventario (negativo)',
  merma_inventario: 'Merma de inventario',
  traspaso_inventario: 'Traspaso de inventario',
  iva_trasladado: 'IVA trasladado',
  iva_acreditable: 'IVA acreditable',
  retencion_iva: 'Retención de IVA',
  retencion_isr: 'Retención de ISR',
  ieps: 'IEPS',
  impuesto_otro: 'Otro impuesto',
};

export const TIPOS_ENTIDAD = [
  'global',
  'contacto',
  'producto',
  'almacen',
  'finanzas_cuenta',
  'concepto',
  'impuesto',
  'producto_familia',
  'producto_linea',
  'producto_clasificacion',
  'producto_tipo',
] as const;

export type TipoEntidad = (typeof TIPOS_ENTIDAD)[number];

export const TIPO_ENTIDAD_LABELS: Record<TipoEntidad, string> = {
  global: 'Global',
  contacto: 'Contacto',
  producto: 'Producto',
  almacen: 'Almacén',
  finanzas_cuenta: 'Cuenta financiera',
  concepto: 'Concepto',
  impuesto: 'Impuesto',
  producto_familia: 'Familia de producto',
  producto_linea: 'Línea de producto',
  producto_clasificacion: 'Clasificación de producto',
  producto_tipo: 'Tipo de producto',
};

const PRODUCTO_TIPOS_ENTIDAD: TipoEntidad[] = [
  'producto',
  'producto_familia',
  'producto_linea',
  'producto_clasificacion',
  'producto_tipo',
];

// Tipos de entidad permitidos por cada uso contable: acota lo que se puede
// elegir en el formulario y evita combinaciones que no tienen sentido de
// negocio (ej. una cuenta financiera asignada a un cliente_cxc).
export const USO_CONTABLE_TIPOS_ENTIDAD_PERMITIDOS: Record<UsoContable, TipoEntidad[]> = {
  cliente_cxc: ['global', 'contacto'],
  proveedor_cxp: ['global', 'contacto'],
  banco_caja: ['finanzas_cuenta'],
  concepto_tesoreria: ['global', 'concepto'],
  venta_producto: ['global', ...PRODUCTO_TIPOS_ENTIDAD],
  compra_producto: ['global', ...PRODUCTO_TIPOS_ENTIDAD],
  inventario_almacen: ['global', 'almacen', ...PRODUCTO_TIPOS_ENTIDAD],
  costo_ventas: ['global', ...PRODUCTO_TIPOS_ENTIDAD],
  ajuste_inventario_positivo: ['global', 'almacen', 'concepto'],
  ajuste_inventario_negativo: ['global', 'almacen', 'concepto'],
  merma_inventario: ['global', 'almacen', 'concepto'],
  traspaso_inventario: ['global', 'almacen', 'concepto'],
  iva_trasladado: ['global', 'impuesto'],
  iva_acreditable: ['global', 'impuesto'],
  retencion_iva: ['global', 'impuesto'],
  retencion_isr: ['global', 'impuesto'],
  ieps: ['global', 'impuesto'],
  impuesto_otro: ['global', 'impuesto'],
};

export interface ConfiguracionCuentaContable {
  id: number;
  empresa_id: number;
  cuenta_id: number;
  contacto_id: number | null;
  producto_id: number | null;
  almacen_id: number | null;
  finanzas_cuenta_id: number | null;
  concepto_id: number | null;
  impuesto_id: string | null;
  producto_familia: string | null;
  producto_linea: string | null;
  producto_clasificacion: string | null;
  producto_tipo: string | null;
  uso_contable: UsoContable;
  activa: boolean;
  notas: string | null;
  creado_en: string;
  actualizado_en: string;
  cuenta: string;
  descripcion_cuenta: string;
  entidad_tipo: TipoEntidad;
  entidad_nombre: string;
}

export type ConfiguracionCuentaContableInput = {
  cuenta_id: number;
  uso_contable: UsoContable | '';
  contacto_id?: number | null;
  producto_id?: number | null;
  almacen_id?: number | null;
  finanzas_cuenta_id?: number | null;
  concepto_id?: number | null;
  impuesto_id?: string | null;
  producto_familia?: string | null;
  producto_linea?: string | null;
  producto_clasificacion?: string | null;
  producto_tipo?: string | null;
  activa?: boolean;
  notas?: string | null;
};

export interface FiltrosConfiguracionCuentaContable {
  uso_contable?: string;
  contacto_id?: number;
  producto_id?: number;
  almacen_id?: number;
  finanzas_cuenta_id?: number;
  concepto_id?: number;
  impuesto_id?: string;
  activa?: boolean;
}
