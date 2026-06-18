export const MAIN_MENUS = [
  { label: 'Catálogos' },
  { label: 'Ventas' },
  { label: 'CRM' },
  { label: 'Compras' },
  { label: 'Finanzas' },
  { label: 'Inventarios' },
  { label: 'Informes' },
  { label: 'Autorizaciones', sidebarOnly: true },
  { label: 'Configuración' },
];

export const MODULE_TABS: Record<string, string[]> = {
  Catálogos: ['Contactos', 'Productos'],
  CRM: [],
  Ventas: [],
  Compras: ['Requisiciones', 'Órdenes de compra', 'Recepciones', 'Facturas'],
  Finanzas: ['Finanzas'],
  Inventarios: ['Movimientos', 'Inventario', 'Ajustes de stock', 'Kardex', 'Ubicaciones', 'Reportes de inventario'],
  Informes: ['Pregúntale a tu negocio'],
  Autorizaciones: [],
  Configuración: [],
};

export const MODULE_DESCRIPTIONS: Record<string, string> = {
  Catálogos: 'Administra los catálogos maestros como contactos y productos.',
  CRM: 'Gestiona conversaciones y oportunidades comerciales desde un solo módulo.',
  Ventas: 'Gestiona el ciclo comercial desde cotizaciones hasta facturación.',
  Compras: 'Controla proveedores, solicitudes y órdenes de compra.',
  Finanzas: 'Supervisa cuentas, movimientos y conciliaciones bancarias.',
  Inventarios: 'Monitorea stock, ajustes, ubicaciones y reportes de inventario.',
  Informes: 'Explora reportes y respuestas ad-hoc sobre tu negocio.',
  Autorizaciones: 'Gestiona solicitudes de autorización y revisa tu bandeja pendiente.',
  Configuración: 'Configura catálogos del sistema, usuarios, roles y empresas.',
};

export const MAIN_MENU_LINKS = [
  { label: 'Contactos', path: '/contactos', description: 'Gestiona y consulta tus contactos registrados.' },
  { label: 'Productos', path: '/productos', description: 'Administra el catálogo de productos y servicios.' },
  { label: 'CRM', path: '/crm', description: 'Gestiona conversaciones y oportunidades comerciales desde un solo módulo.' },
  { label: 'Finanzas', path: '/finanzas', description: 'Supervisa cuentas, movimientos y conciliaciones bancarias.' },
  { label: 'Movimientos de inventario', path: '/inventario/movimientos', description: 'Consulta y registra los movimientos de inventario.' },
  { label: 'Pregúntale a tu negocio', path: '/informes/ia', description: 'Explora reportes y respuestas ad-hoc sobre tu negocio.' },
  { label: 'Configuración', path: '/configuracion', description: 'Configura catálogos del sistema, usuarios, roles y empresas.' },
] as const;
