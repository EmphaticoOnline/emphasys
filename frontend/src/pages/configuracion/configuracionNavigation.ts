export type ConfiguracionNavigationOption = {
	titulo: string;
	descripcion: string;
	path: string;
	soloSuperadmin?: boolean;
};

export const CONFIGURACION_OPTIONS: ConfiguracionNavigationOption[] = [
	{
		titulo: 'Empresas',
		descripcion: 'Configura empresas y sus parámetros generales.',
		path: '/configuracion/empresas',
	},
	{
		titulo: 'Usuarios',
		descripcion: 'Gestiona cuentas de acceso y credenciales.',
		path: '/configuracion/usuarios',
	},
	{
		titulo: 'Roles',
		descripcion: 'Define roles y permisos para los usuarios.',
		path: '/configuracion/roles',
	},
	{
		titulo: 'Catálogos configurables',
		descripcion: 'Administra catálogos basados en core.catalogos_tipos y core.catalogos.',
		path: '/configuracion/catalogos',
	},
	{
		titulo: 'Campos dinámicos',
		descripcion: 'Configura campos dinámicos y sus dependencias.',
		path: '/configuracion/campos',
	},
	{
		titulo: 'Listas de precios',
		descripcion: 'Administra catálogos de listas de precios de venta y compra por empresa.',
		path: '/configuracion/listas-precios',
	},
	{
		titulo: 'Administración de precios',
		descripcion: 'Captura masiva de precios por producto y por lista de precios activa.',
		path: '/configuracion/precios',
	},
	{
		titulo: 'Documentos y flujo',
		descripcion: 'Activa tipos de documento y define las transiciones entre ellos.',
		path: '/configuracion/documentos',
	},
	{
		titulo: 'Parámetros del sistema',
		descripcion: 'Ajusta preferencias y configuraciones globales.',
		path: '/configuracion/parametros',
	},
	{
		titulo: 'Opciones de parámetros',
		descripcion: 'Gestiona opciones para parámetros tipo dropdown.',
		path: '/configuracion/parametros-opciones',
	},
	{
		titulo: 'Conceptos',
		descripcion: 'Administra el catálogo de conceptos financieros.',
		path: '/configuracion/conceptos',
	},
	{
		titulo: 'Impuestos por default',
		descripcion: 'Define los impuestos predeterminados por empresa.',
		path: '/configuracion/empresa/impuestos-default',
	},
	{
		titulo: 'Formatos de impresión',
		descripcion: 'Configura los layouts de PDF por empresa o por serie.',
		path: '/configuracion/formatos-impresion',
	},
	{
		titulo: 'Series de documentos',
		descripcion: 'Administra series por tipo de documento y sus asignaciones por usuario.',
		path: '/configuracion/series-documento',
	},
	{
		titulo: 'Correo SMTP',
		descripcion: 'Configura envío de correos por empresa y por usuario, y prueba la conexión SMTP.',
		path: '/configuracion/correo',
	},
	{
		titulo: 'PAC CFDI',
		descripcion: 'Administra la configuración global del PAC CFDI para sandbox y productivo.',
		path: '/configuracion/cfdi-pac',
		soloSuperadmin: true,
	},
	{
		titulo: 'Descarga de CFDIs del SAT',
		descripcion: 'Configura la e.firma (FIEL) y la autorización de uso para consultar CFDIs del SAT.',
		path: '/configuracion/cfdi-sat',
	},
	{
		titulo: 'Etiquetas de WhatsApp',
		descripcion: 'Administra el catálogo de etiquetas para conversaciones y leads.',
		path: '/configuracion/whatsapp-etiquetas',
	},
	{
		titulo: 'Plantillas de WhatsApp',
		descripcion: 'Administra los registros de plantillas por empresa y tipo.',
		path: '/configuracion/whatsapp-plantillas',
		soloSuperadmin: true,
	},
	{
		titulo: 'Etapas de producción',
		descripcion: 'Configura nombres, colores, secuencia y activación de las etapas operativas.',
		path: '/configuracion/produccion-etapas',
	},
	{
		titulo: 'Campos obligatorios',
		descripcion: 'Define qué campos son obligatorios por entidad y tipo de contacto.',
		path: '/configuracion/campos-obligatorios',
	},
	{
		titulo: 'Métodos de pago',
		descripcion: 'Administra los métodos de pago disponibles para operaciones y programaciones.',
		path: '/configuracion/metodos-pago',
	},
	{
		titulo: 'Políticas de autorización',
		descripcion: 'Define qué transiciones documentales requieren autorización y en qué modo.',
		path: '/configuracion/autorizaciones-reglas',
	},
];