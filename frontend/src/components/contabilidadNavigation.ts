export const CONTABILIDAD_TABS = [
	{
		key: 'cuentas',
		label: 'Cuentas',
		path: '/contabilidad',
		title: 'Catálogo de cuentas',
		description: 'Administración del catálogo de cuentas contables.',
	},
	{
		key: 'polizas',
		label: 'Pólizas',
		path: '/contabilidad/polizas',
		title: 'Pólizas contables',
		description: 'Captura y consulta de pólizas contables.',
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
