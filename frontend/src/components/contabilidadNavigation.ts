export const CONTABILIDAD_TABS = [
	{
		key: 'polizas',
		label: 'Pólizas',
		path: '/contabilidad',
		title: 'Pólizas contables',
		description: 'Captura y consulta de pólizas contables.',
	},
	{
		key: 'cuentas',
		label: 'Cuentas',
		path: '/contabilidad/cuentas',
		title: 'Catálogo de cuentas',
		description: 'Administración del catálogo de cuentas contables.',
	},
	{
		key: 'e-contabilidad',
		label: 'Contabilidad electrónica',
		path: '/contabilidad/e-contabilidad',
		title: 'Contabilidad electrónica',
		description: 'Validaciones y generación de archivos para e-contabilidad SAT.',
	},
	{
		key: 'tipos-poliza',
		label: 'Tipos de póliza',
		path: '/contabilidad/tipos-poliza',
		title: 'Tipos de póliza',
		description: 'Catálogo de tipos de póliza contable.',
	},
	{
		key: 'rangos',
		label: 'Rangos',
		path: '/contabilidad/rangos',
		title: 'Rangos de cuentas',
		description: 'Clasificación y naturaleza de los rangos contables.',
	},
	{
		key: 'configuracion',
		label: 'Configuración',
		path: '/contabilidad/configuracion',
		title: 'Configuración contable',
		description: 'Parámetros generales del módulo de contabilidad.',
	},
] as const;
