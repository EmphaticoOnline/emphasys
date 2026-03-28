export const MAIN_MENUS = [
  { label: 'Catálogos' },
  { label: 'Leads' },
  { label: 'Ventas' },
  { label: 'Compras' },
  { label: 'Finanzas' },
  { label: 'Inventarios' },
  { label: 'Informes' },
  { label: 'Configuración' },
];

export const MODULE_TABS: Record<string, string[]> = {
  Catálogos: ['Contactos', 'Productos'],
  Leads: [],
  Ventas: [],
  Compras: ['Requisiciones', 'Órdenes de compra', 'Recepciones', 'Facturas'],
  Finanzas: ['Finanzas'],
  Inventarios: ['Movimientos', 'Inventario', 'Ajustes de stock', 'Kardex', 'Ubicaciones', 'Reportes de inventario'],
  Informes: ['Pregúntale a tu negocio'],
  Configuración: [],
};

export const MODULE_DESCRIPTIONS: Record<string, string> = {
  Catálogos: 'Administra los catálogos maestros como contactos y productos.',
  Ventas: 'Gestiona el ciclo comercial desde cotizaciones hasta facturación.',
  Compras: 'Controla proveedores, solicitudes y órdenes de compra.',
  Finanzas: 'Supervisa cuentas, movimientos y conciliaciones bancarias.',
  Inventarios: 'Monitorea stock, ajustes, ubicaciones y reportes de inventario.',
  Informes: 'Explora reportes y respuestas ad-hoc sobre tu negocio.',
  Configuración: 'Configura catálogos del sistema, usuarios, roles y empresas.',
};
