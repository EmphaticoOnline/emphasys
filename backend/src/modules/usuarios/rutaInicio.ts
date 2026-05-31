const RUTA_INICIO_PATTERNS = [
	/^\/(contactos|productos|finanzas)$/,
	/^\/crm(?:\/[a-z0-9-]+)?$/,
	/^\/inventario\/[a-z0-9-]+$/,
	/^\/informes\/[a-z0-9-]+$/,
	/^\/configuracion(?:\/[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/,
	/^\/(ventas|compras)\/[a-z0-9_]+$/,
];

export function normalizarRutaInicio(value: unknown): string | null | undefined {
	if (value === undefined) return undefined;
	if (value === null) return null;
	if (typeof value !== 'string') return undefined;
	const ruta = value.trim();
	if (!ruta) return null;
	return ruta;
}

export function esRutaInicioPermitida(ruta: string | null | undefined): ruta is string {
	return typeof ruta === 'string' && RUTA_INICIO_PATTERNS.some((pattern) => pattern.test(ruta));
}