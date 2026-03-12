export const MAIN_MENUS = [
  { label: 'Catálogos' },
  { label: 'Ventas' },
  { label: 'Compras' },
  { label: 'Finanzas' },
  { label: 'Inventarios' },
  { label: 'Configuración' },
];

export const MODULE_TABS: Record<string, string[]> = {
  Catálogos: ['Contactos', 'Productos'],
  Ventas: [],
  Compras: ['Requisiciones', 'Órdenes de compra', 'Recepciones', 'Facturas'],
  Finanzas: ['Cuentas bancarias', 'Movimientos', 'Conciliaciones', 'Presupuestos'],
  Inventarios: ['Inventario', 'Ajustes de stock', 'Kardex', 'Ubicaciones', 'Reportes de inventario'],
  Configuración: [],
};

export const MODULE_DESCRIPTIONS: Record<string, string> = {
  Catálogos: 'Administra los catálogos maestros como contactos y productos.',
  Ventas: 'Gestiona el ciclo comercial desde cotizaciones hasta facturación.',
  Compras: 'Controla proveedores, solicitudes y órdenes de compra.',
  Finanzas: 'Supervisa cuentas, movimientos y conciliaciones financieras.',
  Inventarios: 'Monitorea stock, ajustes, ubicaciones y reportes de inventario.',
  Configuración: 'Configura catálogos del sistema, usuarios, roles y empresas.',
};
