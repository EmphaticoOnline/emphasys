import { fetchParametrosSistema } from '../services/parametrosService';
import { fetchTiposDocumentoHabilitados } from '../services/tiposDocumentoService';
import type { SessionState, User } from '../session/sessionTypes';
import { MAIN_MENU_LINKS } from '../components/navigationData';
import { CRM_TABS } from '../components/crmNavigation';
import { CONFIGURACION_OPTIONS } from '../pages/configuracion/configuracionNavigation';
import { DOCUMENTO_TYPE_CONFIG } from '../modules/documentos/documentoTypeConfig';
import { resolveDocumentosListPath } from '../modules/documentos/documentoNavigation';

export type RutaInicioOption = {
	label: string;
	path: string;
	description: string;
	group: string;
};

export const RUTA_INICIO_FALLBACK = '/contactos';

const RUTA_INICIO_GROUP_ORDER = ['Catálogos', 'Ventas', 'CRM', 'Compras', 'Finanzas', 'Inventarios', 'Informes', 'Configuración'] as const;

const DOCUMENT_SHORT_LABELS: Partial<Record<keyof typeof DOCUMENTO_TYPE_CONFIG, string>> = {
	cotizacion: 'Cotizaciones',
	factura: 'Facturas',
	nota_credito: 'Notas de crédito',
	orden_servicio: 'Órdenes de servicio',
	pago_cliente: 'Pagos',
	requisicion: 'Requisiciones',
	orden_compra: 'Órdenes de compra',
	recepcion: 'Recepciones',
	factura_compra: 'Facturas de compra',
	pago_proveedor: 'Pagos a proveedores',
	nota_credito_compra: 'Notas de crédito de compra',
};

export function normalizarRutaInicio(value: unknown): string | null | undefined {
	if (value === undefined) return undefined;
	if (value === null) return null;
	if (typeof value !== 'string') return undefined;
	const ruta = value.trim();
	if (!ruta) return null;
	return ruta;
}

function toBoolean(value: unknown) {
	if (typeof value === 'boolean') return value;
	const normalized = String(value ?? '').trim().toLowerCase();
	return ['1', 'true', 't', 'yes', 'si', 'sí', 'on'].includes(normalized);
}

function getConfiguredDocumentLabel(codigo: string, nombre: string | null | undefined, nombrePlural: string | null | undefined): string {
	const config = DOCUMENTO_TYPE_CONFIG[codigo as keyof typeof DOCUMENTO_TYPE_CONFIG];
	return DOCUMENT_SHORT_LABELS[codigo as keyof typeof DOCUMENTO_TYPE_CONFIG] ?? nombrePlural ?? config?.label ?? nombre ?? codigo;
}

function compareRutaInicioOptions(a: RutaInicioOption, b: RutaInicioOption) {
	const groupIndexA = RUTA_INICIO_GROUP_ORDER.indexOf(a.group as (typeof RUTA_INICIO_GROUP_ORDER)[number]);
	const groupIndexB = RUTA_INICIO_GROUP_ORDER.indexOf(b.group as (typeof RUTA_INICIO_GROUP_ORDER)[number]);
	const resolvedGroupIndexA = groupIndexA === -1 ? Number.MAX_SAFE_INTEGER : groupIndexA;
	const resolvedGroupIndexB = groupIndexB === -1 ? Number.MAX_SAFE_INTEGER : groupIndexB;

	if (resolvedGroupIndexA !== resolvedGroupIndexB) {
		return resolvedGroupIndexA - resolvedGroupIndexB;
	}

	return a.label.localeCompare(b.label);
}

export async function buildRutaInicioOptions(session: SessionState): Promise<RutaInicioOption[]> {
	const options: RutaInicioOption[] = MAIN_MENU_LINKS.map((item) => ({
		label: item.label,
		path: item.path,
		description: item.description,
		group:
			item.path === '/crm'
				? 'CRM'
				: item.path === '/finanzas'
					? 'Finanzas'
					: item.path.startsWith('/inventario')
						? 'Inventarios'
						: item.path.startsWith('/informes')
							? 'Informes'
							: item.path.startsWith('/configuracion')
								? 'Configuración'
								: 'Catálogos',
	}));

	CRM_TABS.forEach((tab) => {
		options.push({
			label: tab.label,
			path: tab.path,
			description: tab.description,
			group: 'CRM',
		});
	});

	CONFIGURACION_OPTIONS.forEach((option) => {
		if (option.soloSuperadmin && !session.user?.es_superadmin) {
			return;
		}
		options.push({
			label: option.titulo,
			path: option.path,
			description: option.descripcion,
			group: 'Configuración',
		});
	});

	if (session.empresaActivaId) {
		const [ventas, compras, modulos] = await Promise.all([
			fetchTiposDocumentoHabilitados('ventas'),
			fetchTiposDocumentoHabilitados('compras'),
			fetchParametrosSistema(),
		]);

		[...ventas.map((doc) => ({ doc, modulo: 'ventas' as const })), ...compras.map((doc) => ({ doc, modulo: 'compras' as const }))].forEach(({ doc, modulo }) => {
			const path = resolveDocumentosListPath(doc.codigo, modulo);
			const description = getConfiguredDocumentLabel(doc.codigo, doc.nombre, doc.nombre_plural);
			options.push({
				label: description,
				path,
				description,
				group: modulo === 'ventas' ? 'Ventas' : 'Compras',
			});
		});

		const mostrarModuloProduccion = modulos
			.flatMap((modulo) => modulo.parametros)
			.some((parametro) => parametro.clave === 'mostrar_modulo_produccion' && toBoolean(parametro.valor_resuelto));

		if (mostrarModuloProduccion) {
			options.push({
				label: 'Producción',
				path: '/ventas/produccion',
				description: 'Producción',
				group: 'Ventas',
			});
		}
	}

	const unique = new Map<string, RutaInicioOption>();
	options.forEach((option) => {
		if (!unique.has(option.path)) {
			unique.set(option.path, option);
		}
	});

	return [...unique.values()].sort(compareRutaInicioOptions);
}

export function esRutaInicioPermitida(ruta: string | null | undefined, opciones: RutaInicioOption[]): ruta is string {
	return typeof ruta === 'string' && opciones.some((opcion) => opcion.path === ruta);
}

export function resolverRutaInicio(
	rutaInicio: string | null | undefined,
	opciones: RutaInicioOption[],
	usuario?: Pick<User, 'es_superadmin'> | null
): string {
	const ruta = normalizarRutaInicio(rutaInicio);
	if (!ruta || !esRutaInicioPermitida(ruta, opciones)) {
		return RUTA_INICIO_FALLBACK;
	}

	const configuracionPrivada = CONFIGURACION_OPTIONS.find((option) => option.path === ruta && option.soloSuperadmin);
	if (configuracionPrivada && !usuario?.es_superadmin) {
		return RUTA_INICIO_FALLBACK;
	}

	return ruta;
}

export async function resolveRutaInicio(session: SessionState): Promise<string> {
	const opciones = await buildRutaInicioOptions(session);
	return resolverRutaInicio(session.user?.ruta_inicio, opciones, session.user);
}