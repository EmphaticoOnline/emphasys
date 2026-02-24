export const MAIN_MENUS = [
  { label: 'Catálogos' },
  { label: 'Ventas' },
  { label: 'Compras' },
  { label: 'Finanzas' },
  { label: 'Inventarios' },
];

export const MODULE_TABS: Record<string, string[]> = {
  Catálogos: ['Contactos', 'Productos', 'Importar catálogos', 'Listas maestras'],
  Ventas: ['Pedidos', 'Cotizaciones', 'Facturación', 'Clientes y segmentos', 'Reportes de ventas'],
  Compras: ['Órdenes de compra', 'Solicitudes', 'Proveedores', 'Recepciones', 'Reportes de compras'],
  Finanzas: ['Cuentas bancarias', 'Movimientos bancarios', 'Conciliaciones', 'Cobros y pagos', 'Presupuestos'],
  Inventarios: ['Inventario', 'Ajustes de stock', 'Kardex', 'Ubicaciones', 'Reportes de inventario'],
};

export const MODULE_DESCRIPTIONS: Record<string, string> = {
  Catálogos: 'Administra los catálogos maestros como contactos y productos.',
  Ventas: 'Gestiona el ciclo comercial desde cotizaciones hasta facturación.',
  Compras: 'Controla proveedores, solicitudes y órdenes de compra.',
  Finanzas: 'Supervisa cuentas, movimientos y conciliaciones financieras.',
  Inventarios: 'Monitorea stock, ajustes, ubicaciones y reportes de inventario.',
};
