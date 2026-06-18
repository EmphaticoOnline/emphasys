import pool from '../../config/database';
import type { PoolClient } from 'pg';
import type { TipoDocumento } from '../../types/documentos';
import type { TratamientoImpuestos } from '../impuestos/impuestos.types';

type QueryExecutor = Pick<PoolClient, 'query'>;

export const SERIES_DEFAULTS: Record<TipoDocumento, string> = {
  cotizacion: 'COT',
  factura: 'FAC',
  nota_credito: 'NCR',
  pago_cliente: 'PCL',
  orden_servicio: 'OS',
  pedido: 'PED',
  remision: 'REM',
  orden_entrega: 'ODE',
  requisicion: 'REQ',
  orden_compra: 'OC',
  recepcion: 'REC',
  nota_credito_compra: 'NCC',
  pago_proveedor: 'PPR',
  factura_compra: 'FCO',
  ajuste_cliente: 'ACL',
  ajuste_proveedor: 'APR',
};

type SerieDocumentoRow = {
  id: number;
  empresa_id: number;
  tipo_documento: string;
  serie: string;
  descripcion: string | null;
  es_fiscal: boolean;
  activa: boolean;
  ultimo_numero: number;
};

type ResolverSerieArgs = {
  empresaId: number;
  tipoDocumento: TipoDocumento;
  usuarioId?: number | null;
  tratamientoImpuestos?: TratamientoImpuestos | null;
  client?: QueryExecutor;
};

type ReservarNumeroArgs = {
  empresaId: number;
  tipoDocumento: TipoDocumento;
  serie: string;
  client?: QueryExecutor;
};

const FISCAL_SERIES_TYPES = new Set<TipoDocumento>(['factura', 'nota_credito']);

const normalizarTipoDocumento = (tipoDocumento: TipoDocumento) => String(tipoDocumento ?? '').trim().toLowerCase() as TipoDocumento;
const normalizarSerie = (serie: string) => String(serie ?? '').trim();

export function esDocumentoFiscalPorTratamiento(
  tipoDocumento: TipoDocumento,
  tratamientoImpuestos?: TratamientoImpuestos | null
): boolean {
  const tipoNormalizado = normalizarTipoDocumento(tipoDocumento);
  if (!FISCAL_SERIES_TYPES.has(tipoNormalizado)) {
    return false;
  }
  return String(tratamientoImpuestos ?? 'normal').trim().toLowerCase() !== 'sin_iva';
}

async function obtenerSeriePorUsuario(
  empresaId: number,
  tipoDocumento: TipoDocumento,
  usuarioId: number,
  esFiscal: boolean,
  client?: QueryExecutor
): Promise<SerieDocumentoRow | null> {
  const executor = client ?? pool;
  const { rows } = await executor.query<SerieDocumentoRow>(
    `SELECT sd.id,
            sd.empresa_id,
            sd.tipo_documento,
            sd.serie,
            sd.descripcion,
            sd.es_fiscal,
            sd.activa,
            COALESCE(sd.ultimo_numero, 0) AS ultimo_numero
       FROM public.series_documento sd
       JOIN public.usuarios_series_documento usd
         ON usd.serie_documento_id = sd.id
      WHERE usd.usuario_id = $1
        AND sd.empresa_id = $2
        AND LOWER(sd.tipo_documento) = LOWER($3)
        AND sd.activa = true
   ORDER BY CASE WHEN sd.es_fiscal = $4 THEN 0 ELSE 1 END,
            usd.created_at DESC,
            usd.id DESC
      LIMIT 1`,
    [usuarioId, empresaId, tipoDocumento, esFiscal]
  );
  return rows[0] ?? null;
}

async function obtenerSeriePorCriterioFiscal(
  empresaId: number,
  tipoDocumento: TipoDocumento,
  esFiscal: boolean,
  client?: QueryExecutor
): Promise<SerieDocumentoRow | null> {
  const executor = client ?? pool;
  const serieDefault = SERIES_DEFAULTS[normalizarTipoDocumento(tipoDocumento)] ?? null;
  const { rows } = await executor.query<SerieDocumentoRow>(
    `SELECT sd.id,
            sd.empresa_id,
            sd.tipo_documento,
            sd.serie,
            sd.descripcion,
            sd.es_fiscal,
            sd.activa,
            COALESCE(sd.ultimo_numero, 0) AS ultimo_numero
       FROM public.series_documento sd
      WHERE sd.empresa_id = $1
        AND LOWER(sd.tipo_documento) = LOWER($2)
        AND sd.activa = true
        AND sd.es_fiscal = $3
   ORDER BY CASE WHEN COALESCE($4, '') <> '' AND sd.serie = $4 THEN 0 ELSE 1 END,
            sd.id ASC
      LIMIT 1`,
    [empresaId, tipoDocumento, esFiscal, serieDefault]
  );
  return rows[0] ?? null;
}

async function obtenerSerieDefault(
  empresaId: number,
  tipoDocumento: TipoDocumento,
  client?: QueryExecutor
): Promise<SerieDocumentoRow | null> {
  const executor = client ?? pool;
  const serieDefault = SERIES_DEFAULTS[normalizarTipoDocumento(tipoDocumento)] ?? null;
  if (!serieDefault) {
    return null;
  }
  const { rows } = await executor.query<SerieDocumentoRow>(
    `SELECT sd.id,
            sd.empresa_id,
            sd.tipo_documento,
            sd.serie,
            sd.descripcion,
            sd.es_fiscal,
            sd.activa,
            COALESCE(sd.ultimo_numero, 0) AS ultimo_numero
       FROM public.series_documento sd
      WHERE sd.empresa_id = $1
        AND LOWER(sd.tipo_documento) = LOWER($2)
        AND sd.activa = true
        AND sd.serie = $3
      LIMIT 1`,
    [empresaId, tipoDocumento, serieDefault]
  );
  return rows[0] ?? null;
}

async function reservarSiguienteNumeroSerieDocumento(serieDocumentoId: number, client?: QueryExecutor): Promise<number> {
  const executor = client ?? pool;
  const { rows } = await executor.query<{ ultimo_numero: number }>(
    `UPDATE public.series_documento
        SET ultimo_numero = COALESCE(ultimo_numero, 0) + 1,
            updated_at = NOW()
      WHERE id = $1
        AND activa = true
    RETURNING ultimo_numero`,
    [serieDocumentoId]
  );

  const numero = Number(rows[0]?.ultimo_numero ?? 0);
  if (!Number.isFinite(numero) || numero <= 0) {
    throw new Error('No se pudo reservar el consecutivo de la serie.');
  }
  return numero;
}

export async function resolverSerieDocumento(args: ResolverSerieArgs): Promise<SerieDocumentoRow> {
  const { empresaId, tipoDocumento, usuarioId, tratamientoImpuestos, client } = args;
  const tipoNormalizado = normalizarTipoDocumento(tipoDocumento);
  const esFiscal = esDocumentoFiscalPorTratamiento(tipoNormalizado, tratamientoImpuestos);

  if (usuarioId && Number(usuarioId) > 0) {
    const serieUsuario = await obtenerSeriePorUsuario(empresaId, tipoNormalizado, Number(usuarioId), esFiscal, client);
    if (serieUsuario) {
      return serieUsuario;
    }
  }

  const seriePorCriterio = await obtenerSeriePorCriterioFiscal(empresaId, tipoNormalizado, esFiscal, client);
  if (seriePorCriterio) {
    return seriePorCriterio;
  }

  const serieDefault = await obtenerSerieDefault(empresaId, tipoNormalizado, client);
  if (serieDefault) {
    return serieDefault;
  }

  // Fallback: crear la serie automáticamente usando el código por defecto del tipo.
  // Usa ON CONFLICT para ser seguro ante condiciones de carrera.
  const codigoDefault = SERIES_DEFAULTS[tipoNormalizado] ?? null;
  if (codigoDefault) {
    const executor = client ?? pool;
    await executor.query(
      `INSERT INTO public.series_documento
         (empresa_id, tipo_documento, serie, descripcion, es_fiscal, activa, ultimo_numero)
       VALUES ($1, $2, $3, $4, false, true, 0)
       ON CONFLICT (empresa_id, tipo_documento, serie) DO NOTHING`,
      [empresaId, tipoNormalizado, codigoDefault, `${tipoNormalizado} (creada automáticamente)`]
    );
    const { rows } = await executor.query<SerieDocumentoRow>(
      `SELECT id, empresa_id, tipo_documento, serie, descripcion, es_fiscal, activa,
              COALESCE(ultimo_numero, 0) AS ultimo_numero
         FROM public.series_documento
        WHERE empresa_id = $1
          AND LOWER(tipo_documento) = LOWER($2)
          AND serie = $3
          AND activa = true
        LIMIT 1`,
      [empresaId, tipoNormalizado, codigoDefault]
    );
    if (rows[0]) return rows[0];
  }

  throw new Error(`No existe una serie activa configurada para ${tipoNormalizado} (${esFiscal ? 'fiscal' : 'no fiscal'}).`);
}

export async function resolverYReservarSerieDocumento(args: ResolverSerieArgs): Promise<{ serie: string; numero: number; serieDocumentoId: number }> {
  const serieDocumento = await resolverSerieDocumento(args);
  const numero = await reservarSiguienteNumeroSerieDocumento(serieDocumento.id, args.client);
  return {
    serie: serieDocumento.serie,
    numero,
    serieDocumentoId: serieDocumento.id,
  };
}

export async function reservarNumeroParaSerieExistente(args: ReservarNumeroArgs): Promise<number> {
  const { empresaId, tipoDocumento, serie, client } = args;
  const executor = client ?? pool;
  const serieNormalizada = normalizarSerie(serie);

  const { rows } = await executor.query<{ id: number }>(
    `SELECT id
       FROM public.series_documento
      WHERE empresa_id = $1
        AND LOWER(tipo_documento) = LOWER($2)
        AND serie = $3
        AND activa = true
      LIMIT 1`,
    [empresaId, tipoDocumento, serieNormalizada]
  );

  const serieDocumentoId = Number(rows[0]?.id ?? 0);
  if (!Number.isFinite(serieDocumentoId) || serieDocumentoId <= 0) {
    throw new Error(`La serie ${serieNormalizada} no está configurada o no está activa para ${normalizarTipoDocumento(tipoDocumento)}.`);
  }

  return reservarSiguienteNumeroSerieDocumento(serieDocumentoId, client);
}