import pool from "../../config/database";
import type { PoolClient } from "pg";

/**
 * Lanza ServiceError si alguno de los documentos origen tiene un intento de
 * cancelación en estado externo_ok_interno_pendiente. Generar un derivado desde
 * un documento en ese estado resultaría en una inconsistencia fiscal.
 */
async function assertDocumentosSinCancelacionPendiente(
  documentoIds: number[],
  empresaId: number,
  client: PoolClient
): Promise<void> {
  const { rows } = await client.query<{ documento_id: number }>(
    `SELECT documento_id
       FROM public.documentos_cancelacion_intentos
      WHERE documento_id = ANY($1::int[])
        AND empresa_id   = $2
        AND estado       = 'externo_ok_interno_pendiente'
      LIMIT 1`,
    [documentoIds, empresaId]
  );
  if (rows.length > 0) {
    throw new ServiceError(
      'CANCELACION_PENDIENTE',
      'No se puede generar un documento derivado: el documento origen tiene una cancelación CFDI pendiente de sincronización interna',
      409
    );
  }
}
import type { TipoDocumento } from "../../types/documentos";
import type {
  GenerarDocumentoPayload,
  GenerarDocumentoResultado,
  OpcionGeneracion,
  PrepararGeneracionResponse,
  GenerarDocumentoPartidaInput,
} from "./document-generation.types.js";
import { calcularImpuestosPartida } from "../impuestos/impuestos.service";
import { actualizarTotales, asegurarOportunidadParaCotizacion } from "./documentos.service";
import { sanitizarCamposCotizacion } from "./cotizacion-status";
import { reservarNumeroParaSerieExistente, resolverYReservarSerieDocumento } from "./series-documento.service";

class ServiceError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(code: string, message: string, status = 400, details?: any) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type DocumentoGeneracionRow = {
  id: number;
  tipo_documento: TipoDocumento;
  serie: string | null;
  numero: number | null;
  tratamiento_impuestos?: string | null;
  contacto_principal_id: number | null;
  fecha_documento: Date | string | null;
  moneda: string | null;
  tipo_cambio: number | string | null;
  descuento_global: number | string | null;
  contacto_facturacion_id: number | null;
  contacto_entrega_id: number | null;
  agente_id: number | null;
  estatus_documento: string | null;
  observaciones: string | null;
};

type DatosFiscalesGeneracion = {
  rfc_receptor: string | null;
  nombre_receptor: string | null;
  regimen_fiscal_receptor: string | null;
  uso_cfdi: string | null;
  forma_pago: string | null;
  metodo_pago: string | null;
  codigo_postal_receptor: string | null;
};

type PartidaGeneracionRow = {
  partida_id: number;
  documento_id: number;
  producto_id: number | null;
  descripcion: string | null;
  unidad: string | null;
  cantidad_origen: number | string;
  precio_unitario: number | string | null;
  descuento: number | string | null;
  documento_descuento_global: number | string | null;
  documento_serie: string | null;
  documento_numero: number | null;
  numero_partida: number | null;
};

const buildFolio = (serie?: string | null, numero?: number | null) => {
  if (!numero) return null;
  return serie ? `${serie}-${numero}` : `${numero}`;
};

const TIPOS_DOCUMENTO_CON_DATOS_FISCALES = new Set<TipoDocumento>([
  "factura",
  "nota_credito",
  "factura_compra",
  "nota_credito_compra",
]);

type TratamientoImpuestos = 'normal' | 'sin_iva' | 'tasa_cero' | 'exento';

const normalizarCampoFiscal = (value: unknown) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const TRATAMIENTOS_IMPUESTOS_VALIDOS = new Set<TratamientoImpuestos>(['normal', 'sin_iva', 'tasa_cero', 'exento']);

const normalizarTratamientoImpuestos = (value: unknown): TratamientoImpuestos => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return TRATAMIENTOS_IMPUESTOS_VALIDOS.has(normalized as TratamientoImpuestos)
    ? (normalized as TratamientoImpuestos)
    : 'normal';
};

const resolverTratamientoDestino = (
  documentoOrigen: DocumentoGeneracionRow,
  datosEncabezado?: GenerarDocumentoPayload['datos_encabezado']
) : TratamientoImpuestos => {
  const tratamientoExplicito = normalizarCampoFiscal(datosEncabezado?.tratamiento_impuestos);
  if (tratamientoExplicito && TRATAMIENTOS_IMPUESTOS_VALIDOS.has(tratamientoExplicito as TratamientoImpuestos)) {
    return tratamientoExplicito as TratamientoImpuestos;
  }

  return normalizarTratamientoImpuestos(documentoOrigen.tratamiento_impuestos);
};

const estatusDocumentoEsInactivo = (estatusDocumento: string | null | undefined) => {
  const estatusNormalizado = String(estatusDocumento ?? "").trim().toLowerCase();
  return estatusNormalizado === "cancelado" || estatusNormalizado === "cancelada";
};

const normalizarIdsDocumentoOrigen = (payload: GenerarDocumentoPayload) => {
  const ids = [
    ...(Number.isFinite(Number(payload.documento_origen_id)) && Number(payload.documento_origen_id) > 0
      ? [Number(payload.documento_origen_id)]
      : []),
    ...((payload.documento_origen_ids ?? [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)),
  ];

  return Array.from(new Set(ids));
};

async function cargarDatosFiscalesContacto(
  contactoId: number,
  empresaId: number,
  client: PoolClient
): Promise<DatosFiscalesGeneracion> {
  const { rows: contactoRows } = await client.query<{
    nombre: string | null;
    rfc: string | null;
    regimen_fiscal: string | null;
    uso_cfdi: string | null;
    forma_pago: string | null;
    metodo_pago: string | null;
  }>(
    `SELECT c.nombre,
            COALESCE(cdf.rfc, c.rfc) AS rfc,
            cdf.regimen_fiscal,
            cdf.uso_cfdi,
            cdf.forma_pago,
            cdf.metodo_pago
       FROM contactos c
       LEFT JOIN contactos_datos_fiscales cdf
         ON cdf.contacto_id = c.id
      WHERE c.id = $1
        AND c.empresa_id = $2
      LIMIT 1`,
    [contactoId, empresaId]
  );

  const { rows: domicilioRows } = await client.query<{ cp_sat: string | null }>(
    `SELECT cp_sat
       FROM contactos_domicilios
      WHERE contacto_id = $1
        AND es_principal = true
      LIMIT 1`,
    [contactoId]
  );

  const contacto = contactoRows[0] || {
    nombre: null,
    rfc: null,
    regimen_fiscal: null,
    uso_cfdi: null,
    forma_pago: null,
    metodo_pago: null,
  };

  return {
    rfc_receptor: normalizarCampoFiscal(contacto.rfc),
    nombre_receptor: normalizarCampoFiscal(contacto.nombre),
    regimen_fiscal_receptor: normalizarCampoFiscal(contacto.regimen_fiscal),
    uso_cfdi: normalizarCampoFiscal(contacto.uso_cfdi),
    forma_pago: normalizarCampoFiscal(contacto.forma_pago),
    metodo_pago: normalizarCampoFiscal(contacto.metodo_pago),
    codigo_postal_receptor: normalizarCampoFiscal(domicilioRows[0]?.cp_sat ?? null),
  };
}

async function resolverDatosFiscalesDocumento(
  tipoDocumentoDestino: TipoDocumento,
  datosEncabezado: GenerarDocumentoPayload["datos_encabezado"],
  contactoPrincipalId: number | null,
  empresaId: number,
  client: PoolClient,
  documentoDestinoExistente?: Record<string, any> | null
): Promise<DatosFiscalesGeneracion> {
  const datosBase: DatosFiscalesGeneracion = {
    rfc_receptor: normalizarCampoFiscal(datosEncabezado?.rfc_receptor)
      ?? normalizarCampoFiscal(documentoDestinoExistente?.rfc_receptor),
    nombre_receptor: normalizarCampoFiscal(datosEncabezado?.nombre_receptor)
      ?? normalizarCampoFiscal(documentoDestinoExistente?.nombre_receptor),
    regimen_fiscal_receptor: normalizarCampoFiscal(datosEncabezado?.regimen_fiscal_receptor)
      ?? normalizarCampoFiscal(documentoDestinoExistente?.regimen_fiscal_receptor),
    uso_cfdi: normalizarCampoFiscal(datosEncabezado?.uso_cfdi)
      ?? normalizarCampoFiscal(documentoDestinoExistente?.uso_cfdi),
    forma_pago: normalizarCampoFiscal(datosEncabezado?.forma_pago)
      ?? normalizarCampoFiscal(documentoDestinoExistente?.forma_pago),
    metodo_pago: normalizarCampoFiscal(datosEncabezado?.metodo_pago)
      ?? normalizarCampoFiscal(documentoDestinoExistente?.metodo_pago),
    codigo_postal_receptor: normalizarCampoFiscal(datosEncabezado?.codigo_postal_receptor)
      ?? normalizarCampoFiscal(documentoDestinoExistente?.codigo_postal_receptor),
  };

  if (!TIPOS_DOCUMENTO_CON_DATOS_FISCALES.has(tipoDocumentoDestino) || !contactoPrincipalId) {
    return datosBase;
  }

  const faltanDatosFiscales = Object.values(datosBase).some((value) => value == null);
  if (!faltanDatosFiscales) {
    return datosBase;
  }

  try {
    const datosContacto = await cargarDatosFiscalesContacto(contactoPrincipalId, empresaId, client);
    return {
      rfc_receptor: datosBase.rfc_receptor ?? datosContacto.rfc_receptor,
      nombre_receptor: datosBase.nombre_receptor ?? datosContacto.nombre_receptor,
      regimen_fiscal_receptor: datosBase.regimen_fiscal_receptor ?? datosContacto.regimen_fiscal_receptor,
      uso_cfdi: datosBase.uso_cfdi ?? datosContacto.uso_cfdi,
      forma_pago: datosBase.forma_pago ?? datosContacto.forma_pago,
      metodo_pago: datosBase.metodo_pago ?? datosContacto.metodo_pago,
      codigo_postal_receptor: datosBase.codigo_postal_receptor ?? datosContacto.codigo_postal_receptor,
    };
  } catch (error) {
    console.warn("No se pudieron resolver datos fiscales para documento generado", {
      contacto_principal_id: contactoPrincipalId,
      tipo_documento_destino: tipoDocumentoDestino,
      error,
    });
    return datosBase;
  }
}

async function cargarDocumentosOrigen(
  documentoIds: number[],
  empresaId: number,
  client: PoolClient,
  forUpdate = false
): Promise<DocumentoGeneracionRow[]> {
  const lockClause = forUpdate ? 'FOR SHARE' : '';
  const { rows } = await client.query<DocumentoGeneracionRow>(
    `SELECT id,
            tipo_documento,
            serie,
            numero,
          tratamiento_impuestos,
            contacto_principal_id,
            fecha_documento,
            moneda,
            tipo_cambio,
            descuento_global,
            contacto_facturacion_id,
            contacto_entrega_id,
            agente_id,
            estatus_documento,
            observaciones
       FROM documentos
      WHERE empresa_id = $1
        AND id = ANY($2::int[])
      ORDER BY fecha_documento, id
      ${lockClause}`,
    [empresaId, documentoIds]
  );

  return rows;
}

async function validarFlujosOrigenDestino(
  documentosOrigen: DocumentoGeneracionRow[],
  tipoDestino: TipoDocumento,
  empresaId: number,
  client: PoolClient
) {
  for (const documento of documentosOrigen) {
    const { rowCount } = await client.query(
      `SELECT 1
         FROM core.empresas_tipos_documento_transiciones etd
         JOIN core.tipos_documento td_origen ON td_origen.id = etd.tipo_documento_origen_id
         JOIN core.tipos_documento td_dest   ON td_dest.id   = etd.tipo_documento_destino_id
        WHERE etd.empresa_id = $1
          AND etd.activo = true
          AND LOWER(td_origen.codigo) = LOWER($2)
          AND LOWER(td_dest.codigo) = LOWER($3)
        LIMIT 1`,
      [empresaId, documento.tipo_documento, tipoDestino]
    );

    if (!rowCount) {
      throw new ServiceError("FLUJO_NO_PERMITIDO", "Tipo de documento destino no permitido para este origen", 400, {
        documento_origen_id: Number(documento.id),
        tipo_documento_origen: documento.tipo_documento,
        tipo_documento_destino: tipoDestino,
      });
    }
  }
}

function requiereValidacionDeFlujoOrigenDestino(tipoDestino: TipoDocumento) {
  const tipoDestinoNormalizado = String(tipoDestino ?? '').toLowerCase();
  return !['nota_credito', 'nota_credito_compra'].includes(tipoDestinoNormalizado);
}

function validarCompatibilidadConsolidada(documentosOrigen: DocumentoGeneracionRow[], tipoDestino: TipoDocumento) {
  if (documentosOrigen.length <= 1) return;

  const tipos = Array.from(new Set(documentosOrigen.map((documento) => String(documento.tipo_documento ?? '').toLowerCase())));
  if (tipos.length !== 1) {
    throw new ServiceError("ORIGENES_INCOMPATIBLES", "Los documentos seleccionados deben ser del mismo tipo", 400);
  }

  const tipoOrigen = tipos[0];
  if (!['factura', 'factura_compra'].includes(tipoOrigen)) {
    throw new ServiceError("ORIGENES_INCOMPATIBLES", "La consolidación solo está disponible para facturas activas", 400);
  }

  const tipoDestinoEsperado = tipoOrigen === 'factura' ? 'nota_credito' : 'nota_credito_compra';
  if (String(tipoDestino).toLowerCase() !== tipoDestinoEsperado) {
    throw new ServiceError("ORIGENES_INCOMPATIBLES", "El tipo destino no es compatible con la selección consolidada", 400);
  }

  const contactoBase = documentosOrigen[0]?.contacto_principal_id ?? null;
  const monedaBase = String(documentosOrigen[0]?.moneda ?? '').trim().toUpperCase();
  const documentoInactivo = documentosOrigen.find((documento) => estatusDocumentoEsInactivo(documento.estatus_documento));
  if (documentoInactivo) {
    throw new ServiceError("ORIGENES_INCOMPATIBLES", "Solo se pueden consolidar documentos activos", 400, {
      documento_origen_id: Number(documentoInactivo.id),
    });
  }

  const distintoContacto = documentosOrigen.find((documento) => (documento.contacto_principal_id ?? null) !== contactoBase);
  if (distintoContacto) {
    throw new ServiceError("ORIGENES_INCOMPATIBLES", "Los documentos seleccionados deben pertenecer al mismo cliente o proveedor", 400);
  }

  const distintaMoneda = documentosOrigen.find((documento) => String(documento.moneda ?? '').trim().toUpperCase() !== monedaBase);
  if (distintaMoneda) {
    throw new ServiceError("ORIGENES_INCOMPATIBLES", "Los documentos seleccionados deben usar la misma moneda", 400);
  }
}

async function cargarPartidasOrigen(documentoIds: number[], client: PoolClient): Promise<PartidaGeneracionRow[]> {
  const { rows } = await client.query<PartidaGeneracionRow>(
    `SELECT dp.id AS partida_id,
            dp.documento_id,
            dp.producto_id,
            COALESCE(dp.descripcion_alterna, p.descripcion) AS descripcion,
            dp.unidad,
            dp.cantidad AS cantidad_origen,
            dp.precio_unitario,
            dp.descuento,
            d.descuento_global AS documento_descuento_global,
            d.serie AS documento_serie,
            d.numero AS documento_numero,
            dp.numero_partida
       FROM documentos_partidas dp
       JOIN documentos d ON d.id = dp.documento_id
       LEFT JOIN productos p ON p.id = dp.producto_id
      WHERE dp.documento_id = ANY($1::int[])
      ORDER BY d.fecha_documento, d.id, dp.numero_partida`,
    [documentoIds]
  );

  return rows;
}

async function cargarCantidadesGeneradas(documentoIds: number[], client: PoolClient) {
  const { rows } = await client.query<{ partida_origen_id: number; cantidad_generada: string }>(
    `SELECT partida_origen_id, COALESCE(SUM(cantidad), 0) AS cantidad_generada
       FROM documentos_partidas_vinculos
      WHERE documento_origen_id = ANY($1::int[])
      GROUP BY partida_origen_id`,
    [documentoIds]
  );

  return new Map<number, number>(rows.map((row) => [Number(row.partida_origen_id), Number(row.cantidad_generada)]));
}

function construirRespuestaPreparacion(
  documentosOrigen: DocumentoGeneracionRow[],
  tipoDestino: TipoDocumento,
  partidas: PartidaGeneracionRow[],
  cantidadesGeneradas: Map<number, number>
): PrepararGeneracionResponse {
  const documentos = documentosOrigen.map((documento) => ({
    documento_id: Number(documento.id),
    tipo_documento: documento.tipo_documento,
    folio: buildFolio(documento.serie, documento.numero),
    tratamiento_impuestos: normalizarTratamientoImpuestos(documento.tratamiento_impuestos),
  }));

  return {
    documento_origen: documentos.length === 1 ? documentos[0] : null,
    documentos_origen: documentos,
    es_consolidado: documentos.length > 1,
    tipo_documento_destino: tipoDestino,
    partidas: partidas.map((partida) => {
      const yaGenerada = cantidadesGeneradas.get(Number(partida.partida_id)) || 0;
      const pendiente = Math.max(Number(partida.cantidad_origen) - yaGenerada, 0);
      const descuentoPartida = Math.min(100, Math.max(0, Number(partida.descuento ?? 0) || 0));
      const descuentoGlobal = Math.min(100, Math.max(0, Number(partida.documento_descuento_global ?? 0) || 0));
      const factorNeto = (1 - (descuentoPartida / 100)) * (1 - (descuentoGlobal / 100));
      const importeMaximo = Number((pendiente * Number(partida.precio_unitario ?? 0) * Math.max(factorNeto, 0)).toFixed(2));
      return {
        partida_id: Number(partida.partida_id),
        documento_origen_id: Number(partida.documento_id),
        documento_origen_folio: buildFolio(partida.documento_serie, partida.documento_numero),
        producto_id: partida.producto_id ? Number(partida.producto_id) : null,
        descripcion: partida.descripcion ?? null,
        unidad: partida.unidad ?? null,
        cantidad_origen: Number(partida.cantidad_origen),
        cantidad_ya_generada: yaGenerada,
        cantidad_pendiente_sugerida: pendiente,
        cantidad_default: pendiente,
        precio_unitario: Number(partida.precio_unitario ?? 0),
        importe_maximo_sugerido: importeMaximo,
      };
    }),
  };
}

async function aplicarConversionComercialDesdeCotizacion(
  documentoOrigenId: number,
  oportunidadId: number,
  client: PoolClient
) {
  await client.query(
    `UPDATE crm.oportunidades_venta
        SET estatus = 'convertida',
            updated_at = NOW()
      WHERE id = $1`,
    [oportunidadId]
  );

  await client.query(
    `UPDATE documentos
        SET estado_seguimiento = 'convertida'
      WHERE id = $1
        AND LOWER(tipo_documento) = 'cotizacion'`,
    [documentoOrigenId]
  );

  await client.query(
    `UPDATE documentos
        SET estado_seguimiento = 'no seleccionada'
      WHERE oportunidad_id = $1
        AND id <> $2
        AND LOWER(tipo_documento) = 'cotizacion'
        AND LOWER(TRIM(COALESCE(estado_seguimiento, ''))) IN (
          'abierta',
          'borrador',
          'enviado',
          'en negociacion',
          'negociacion',
          'cotizado'
        )`,
    [oportunidadId, documentoOrigenId]
  );
}

export class DocumentGenerationService {
  static async getOpcionesGeneracion(documentoId: number, empresaId: number): Promise<OpcionGeneracion[]> {
    const client = await pool.connect();
    try {
      const { rows: docRows } = await client.query(
        `SELECT id, tipo_documento
           FROM documentos
          WHERE id = $1 AND empresa_id = $2
          LIMIT 1`,
        [documentoId, empresaId]
      );

      const documento = docRows[0];
      if (!documento) {
        throw new ServiceError("DOCUMENTO_NO_ENCONTRADO", "Documento origen no encontrado", 404);
      }

      console.log("[GenDoc] getOpcionesGeneracion", {
        documentoId,
        empresaId,
        tipo_documento_origen: documento.tipo_documento,
      });

      const { rows } = await client.query(
        `SELECT td_dest.codigo AS tipo_documento_destino, td_dest.nombre, etd.orden
           FROM core.empresas_tipos_documento_transiciones etd
           JOIN core.tipos_documento td_origen ON td_origen.id = etd.tipo_documento_origen_id
           JOIN core.tipos_documento td_dest   ON td_dest.id   = etd.tipo_documento_destino_id
          WHERE etd.empresa_id = $1
            AND etd.activo = true
            AND td_dest.activo = true
            AND LOWER(td_origen.codigo) = LOWER($2)
          ORDER BY etd.orden, td_dest.orden, td_dest.nombre`,
        [empresaId, documento.tipo_documento]
      );

      console.log("[GenDoc] opciones result", {
        documentoId,
        empresaId,
        tipo_documento_origen: documento.tipo_documento,
        rows_count: rows.length,
        rows,
      });

      return rows.map((row) => ({
        tipo_documento_destino: row.tipo_documento_destino as TipoDocumento,
        nombre: row.nombre ?? row.tipo_documento_destino,
        orden: row.orden !== null && row.orden !== undefined ? Number(row.orden) : undefined,
      }));
    } finally {
      client.release();
    }
  }

  static async prepararGeneracion(
    documentoId: number,
    tipoDestino: TipoDocumento,
    empresaId: number
  ): Promise<PrepararGeneracionResponse> {
    return this.prepararGeneracionMultiple([documentoId], tipoDestino, empresaId);
  }

  static async prepararGeneracionMultiple(
    documentoIds: number[],
    tipoDestino: TipoDocumento,
    empresaId: number
  ): Promise<PrepararGeneracionResponse> {
    const client = await pool.connect();
    try {
      const idsNormalizados = Array.from(new Set(documentoIds.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)));
      if (idsNormalizados.length === 0) {
        throw new ServiceError("DOCUMENTO_NO_ENCONTRADO", "Documento origen no encontrado", 404);
      }

      const documentosOrigen = await cargarDocumentosOrigen(idsNormalizados, empresaId, client);
      if (documentosOrigen.length !== idsNormalizados.length) {
        throw new ServiceError("DOCUMENTO_NO_ENCONTRADO", "Documento origen no encontrado", 404);
      }

      validarCompatibilidadConsolidada(documentosOrigen, tipoDestino);
      if (requiereValidacionDeFlujoOrigenDestino(tipoDestino)) {
        await validarFlujosOrigenDestino(documentosOrigen, tipoDestino, empresaId, client);
      }

      const partidas = await cargarPartidasOrigen(idsNormalizados, client);
      const cantidadesGeneradas = await cargarCantidadesGeneradas(idsNormalizados, client);

      return construirRespuestaPreparacion(documentosOrigen, tipoDestino, partidas, cantidadesGeneradas);
    } finally {
      client.release();
    }
  }

  static async generarDocumentoDesdeOrigen(
    payload: GenerarDocumentoPayload,
    empresaId: number,
    usuarioId?: number | null
  ): Promise<GenerarDocumentoResultado> {
    const client = await pool.connect();
    try {
      const documentoOrigenIds = normalizarIdsDocumentoOrigen(payload);
      const { tipo_documento_destino, datos_encabezado, partidas } = payload;
      if (!partidas || partidas.length === 0) {
        throw new ServiceError("PARTIDAS_REQUERIDAS", "Se requiere al menos una partida para generar el documento destino");
      }
      if (documentoOrigenIds.length === 0) {
        throw new ServiceError("DOCUMENTO_NO_ENCONTRADO", "Documento origen no encontrado", 404);
      }

      await client.query("BEGIN");

      const documentosOrigen = await cargarDocumentosOrigen(documentoOrigenIds, empresaId, client, true);
      if (documentosOrigen.length !== documentoOrigenIds.length) {
        throw new ServiceError("DOCUMENTO_NO_ENCONTRADO", "Documento origen no encontrado", 404);
      }

      validarCompatibilidadConsolidada(documentosOrigen, tipo_documento_destino);
  await assertDocumentosSinCancelacionPendiente(documentoOrigenIds, empresaId, client);
  if (requiereValidacionDeFlujoOrigenDestino(tipo_documento_destino)) {
        await validarFlujosOrigenDestino(documentosOrigen, tipo_documento_destino, empresaId, client);
      }

      const documentoOrigen = documentosOrigen[0];
      const esConsolidado = documentosOrigen.length > 1;
      const documentoDestinoExistenteId = Number(payload.documento_destino_id ?? 0);
      const esEdicionDocumentoDestino = Number.isFinite(documentoDestinoExistenteId) && documentoDestinoExistenteId > 0;

      const partidaIds = Array.from(new Set(partidas.map((p: GenerarDocumentoPartidaInput) => Number(p.partida_origen_id))));
      const { rows: partidasOrigen } = await client.query<PartidaGeneracionRow & {
        cantidad: number | string;
        producto_id: number | null;
        descripcion_alterna: string | null;
      }>(
        `SELECT dp.id AS partida_id,
                dp.documento_id,
                dp.producto_id,
                dp.descripcion_alterna,
                dp.cantidad AS cantidad_origen,
                dp.precio_unitario,
                dp.descuento,
                dp.numero_partida,
                d.descuento_global AS documento_descuento_global,
                d.serie AS documento_serie,
                d.numero AS documento_numero
           FROM documentos_partidas dp
           JOIN documentos d ON d.id = dp.documento_id
          WHERE dp.documento_id = ANY($1::int[])
            AND dp.id = ANY($2::int[])
          ORDER BY d.fecha_documento, d.id, dp.numero_partida`,
        [documentoOrigenIds, partidaIds]
      );

      if (partidasOrigen.length !== partidaIds.length) {
        throw new ServiceError("PARTIDAS_INVALIDAS", "Algunas partidas no pertenecen al documento origen", 400);
      }

      const origenesUnicosPartidas = Array.from(new Set(partidasOrigen.map((partida) => Number(partida.documento_id))));
      const documentoOrigenUnicoId = origenesUnicosPartidas.length === 1 ? origenesUnicosPartidas[0] : null;

      const camposCotizacion: { estado_seguimiento: string } | null = tipo_documento_destino === "cotizacion"
        ? sanitizarCamposCotizacion({ estado_seguimiento: undefined as string | undefined }, { applyDefaults: true }) as { estado_seguimiento: string }
        : null;
      const fechaDocumento = datos_encabezado?.fecha ?? new Date();
      const descuentoGlobalDocumento = esConsolidado
        ? 0
        : Math.min(100, Math.max(0, Number(documentoOrigen.descuento_global ?? 0) || 0));
      const tratamientoDestino = resolverTratamientoDestino(documentoOrigen, datos_encabezado);
      let documentoDestino: any;

      if (esEdicionDocumentoDestino) {
        const { rows: documentoDestinoRows } = await client.query(
          `SELECT *
             FROM documentos
            WHERE id = $1
              AND empresa_id = $2
            LIMIT 1`,
          [documentoDestinoExistenteId, empresaId]
        );

        const documentoDestinoExistente = documentoDestinoRows[0];
        if (!documentoDestinoExistente) {
          throw new ServiceError("DOCUMENTO_NO_ENCONTRADO", "Documento destino no encontrado", 404);
        }
        if (String(documentoDestinoExistente.tipo_documento).toLowerCase() !== String(tipo_documento_destino).toLowerCase()) {
          throw new ServiceError("DOCUMENTO_INVALIDO", "El documento destino no coincide con el tipo solicitado", 400);
        }

        const serieDestino = datos_encabezado?.serie
          ? String(datos_encabezado.serie).trim()
          : String(documentoDestinoExistente.serie ?? '').trim();
        const numeroDestino = datos_encabezado?.serie && serieDestino !== String(documentoDestinoExistente.serie ?? '').trim()
          ? await reservarNumeroParaSerieExistente({
              empresaId,
              tipoDocumento: tipo_documento_destino,
              serie: serieDestino,
              client,
            })
          : Number(documentoDestinoExistente.numero ?? 0) || null;

        await client.query(
          `DELETE FROM documentos_partidas_impuestos
            WHERE partida_id IN (
              SELECT id
              FROM documentos_partidas
              WHERE documento_id = $1
            )`,
          [documentoDestinoExistenteId]
        );
        await client.query(
          `DELETE FROM documentos_partidas_vinculos
            WHERE documento_destino_id = $1`,
          [documentoDestinoExistenteId]
        );
        await client.query(
          `DELETE FROM documentos_partidas
            WHERE documento_id = $1`,
          [documentoDestinoExistenteId]
        );

        const contactoPrincipalIdDestino = Number(
          datos_encabezado?.contacto_principal_id
          ?? documentoOrigen.contacto_principal_id
          ?? documentoDestinoExistente.contacto_principal_id
          ?? 0
        ) || null;
        const datosFiscalesDocumento = await resolverDatosFiscalesDocumento(
          tipo_documento_destino,
          datos_encabezado,
          contactoPrincipalIdDestino,
          empresaId,
          client,
          documentoDestinoExistente
        );

        const { rows: documentoDestinoActualizadoRows } = await client.query(
          `UPDATE documentos
              SET serie = $3,
                  numero = $4,
                  fecha_documento = $5,
                  contacto_principal_id = $6,
                  agente_id = $7,
                  moneda = $8,
                  tipo_cambio = $9,
                  subtotal = 0,
                  iva = 0,
                  total = 0,
                  descuento_global = $10,
                  observaciones = $11,
                  motivo_nc = $12,
                  concepto_id = $13,
                  producto_resumen = $14,
                  documento_origen_id = $15,
                  rfc_receptor = $16,
                  nombre_receptor = $17,
                  regimen_fiscal_receptor = $18,
                  uso_cfdi = $19,
                  forma_pago = $20,
                  metodo_pago = $21,
                  codigo_postal_receptor = $22,
                  tratamiento_impuestos = $23
            WHERE id = $1
              AND empresa_id = $2
            RETURNING *`,
          [
            documentoDestinoExistenteId,
            empresaId,
            serieDestino,
            numeroDestino,
            fechaDocumento,
            contactoPrincipalIdDestino,
            documentoOrigen.agente_id ?? documentoDestinoExistente.agente_id ?? null,
            documentoOrigen.moneda ?? documentoDestinoExistente.moneda ?? null,
            documentoOrigen.tipo_cambio ?? documentoDestinoExistente.tipo_cambio ?? null,
            descuentoGlobalDocumento,
            datos_encabezado?.comentarios ?? documentoOrigen.observaciones ?? documentoDestinoExistente.observaciones ?? null,
            datos_encabezado?.motivo_nc ?? documentoDestinoExistente.motivo_nc ?? null,
            datos_encabezado?.concepto_id ?? documentoDestinoExistente.concepto_id ?? null,
            datos_encabezado?.producto_resumen ?? documentoDestinoExistente.producto_resumen ?? null,
            documentoOrigenUnicoId,
            datosFiscalesDocumento.rfc_receptor,
            datosFiscalesDocumento.nombre_receptor,
            datosFiscalesDocumento.regimen_fiscal_receptor,
            datosFiscalesDocumento.uso_cfdi,
            datosFiscalesDocumento.forma_pago,
            datosFiscalesDocumento.metodo_pago,
            datosFiscalesDocumento.codigo_postal_receptor,
            tratamientoDestino,
          ]
        );

        documentoDestino = documentoDestinoActualizadoRows[0];
      } else {
        const serieResuelta = await resolverYReservarSerieDocumento({
          empresaId,
          tipoDocumento: tipo_documento_destino,
          usuarioId: usuarioId ?? null,
          tratamientoImpuestos: tratamientoDestino,
          client,
        });
        const serieDestino = serieResuelta.serie;
        const nextNumero = serieResuelta.numero;
        const contactoPrincipalIdDestino = Number(
          datos_encabezado?.contacto_principal_id
          ?? documentoOrigen.contacto_principal_id
          ?? 0
        ) || null;
        const datosFiscalesDocumento = await resolverDatosFiscalesDocumento(
          tipo_documento_destino,
          datos_encabezado,
          contactoPrincipalIdDestino,
          empresaId,
          client
        );
        const columnasCotizacion = camposCotizacion ? ",\n            estado_seguimiento" : "";
        const valoresCotizacion = camposCotizacion ? ",\n            $27" : "";

        const { rows: insertDocRows } = await client.query(
          `INSERT INTO documentos (
              empresa_id,
              tipo_documento,
              estatus_documento,
              serie,
              numero,
              fecha_documento,
              contacto_principal_id,
              contacto_facturacion_id,
              contacto_entrega_id,
              agente_id,
              moneda,
              tipo_cambio,
              subtotal,
              iva,
              total,
              descuento_global,
              observaciones,
              motivo_nc,
              concepto_id,
              producto_resumen,
              documento_origen_id,
              rfc_receptor,
              nombre_receptor,
              regimen_fiscal_receptor,
              uso_cfdi,
              forma_pago,
              metodo_pago,
              codigo_postal_receptor,
              tratamiento_impuestos,
              usuario_creacion_id${columnasCotizacion}
            ) VALUES (
              $1, $2, 'Borrador', $3, $4, $5,
              $6, $7, $8, $9,
              $10, $11,
              0, 0, 0,
              $12,
              $13,
              $14,
              $15,
              $16,
              $17,
              $18,
              $19,
              $20,
              $21,
              $22,
              $23,
              $24,
              $25,
              $26${valoresCotizacion}
            )
            RETURNING *`,
          [
            empresaId,
            tipo_documento_destino,
            serieDestino,
            nextNumero,
            fechaDocumento,
            contactoPrincipalIdDestino,
            documentoOrigen.contacto_facturacion_id ?? null,
            documentoOrigen.contacto_entrega_id ?? null,
            documentoOrigen.agente_id ?? null,
            documentoOrigen.moneda,
            documentoOrigen.tipo_cambio ?? null,
            descuentoGlobalDocumento,
            datos_encabezado?.comentarios ?? documentoOrigen.observaciones ?? null,
            datos_encabezado?.motivo_nc ?? null,
            datos_encabezado?.concepto_id ?? null,
            datos_encabezado?.producto_resumen ?? null,
            documentoOrigenUnicoId,
            datosFiscalesDocumento.rfc_receptor,
            datosFiscalesDocumento.nombre_receptor,
            datosFiscalesDocumento.regimen_fiscal_receptor,
            datosFiscalesDocumento.uso_cfdi,
            datosFiscalesDocumento.forma_pago,
            datosFiscalesDocumento.metodo_pago,
            datosFiscalesDocumento.codigo_postal_receptor,
            tratamientoDestino,
            usuarioId ?? null,
            ...(camposCotizacion ? [camposCotizacion.estado_seguimiento] : []),
          ]
        );

        documentoDestino = insertDocRows[0];
      }

      const cantidadesGeneradas = await cargarCantidadesGeneradas(documentoOrigenIds, client);

      if (tipo_documento_destino === "cotizacion") {
        await asegurarOportunidadParaCotizacion(
          {
            id: Number(documentoDestino.id),
            tipo_documento: tipo_documento_destino,
            agente_id: documentoDestino.agente_id ?? documentoOrigen.agente_id ?? null,
          },
          {
            contacto_principal_id: (datos_encabezado?.contacto_principal_id as number | null | undefined)
              ?? documentoOrigen.contacto_principal_id
              ?? null,
            agente_id: documentoDestino.agente_id ?? documentoOrigen.agente_id ?? null,
            conversacion_id: (datos_encabezado?.conversacion_id as number | null | undefined) ?? null,
          },
          empresaId,
          client
        );
      }

  const partidasGeneradas: { partida_destino_id: number; partida_origen_id: number; cantidad: number }[] = [];

      for (const [idx, partidaPayload] of partidas.entries()) {
        const partidaOrigen = partidasOrigen.find((p) => Number(p.partida_id) === Number(partidaPayload.partida_origen_id));
        if (!partidaOrigen) {
          throw new ServiceError("PARTIDA_NO_ENCONTRADA", `Partida origen ${partidaPayload.partida_origen_id} no encontrada`, 400);
        }

        const cantidad = Number(partidaPayload.cantidad ?? 0);
        const montoBonificacion = Number(partidaPayload.monto_bonificacion ?? 0);
        const esBonificacion = (datos_encabezado?.motivo_nc ?? null) === 'bonificacion';
        if (!esBonificacion && cantidad <= 0) {
          throw new ServiceError("CANTIDAD_INVALIDA", "Las cantidades deben ser mayores a cero", 400);
        }

        const precioUnitario = Number(partidaOrigen.precio_unitario ?? 0);
        const descuento = Math.min(100, Math.max(0, Number(partidaOrigen.descuento ?? 0) || 0));
        const descuentoGlobalOrigen = Math.min(100, Math.max(0, Number(partidaOrigen.documento_descuento_global ?? 0) || 0));
        const cantidadOrigen = Number(partidaOrigen.cantidad_origen ?? 0);
        const cantidadYaGenerada = cantidadesGeneradas.get(Number(partidaOrigen.partida_id)) || 0;
        const cantidadDisponible = Math.max(Number((cantidadOrigen - cantidadYaGenerada).toFixed(6)), 0);
        const baseBruta = Number((cantidad * precioUnitario).toFixed(2));
        const subtotalDespuesDescuentoPartida = Number((baseBruta - (baseBruta * (descuento / 100))).toFixed(2));
        const subtotalPartidaDefault = Number((subtotalDespuesDescuentoPartida - (subtotalDespuesDescuentoPartida * (descuentoGlobalOrigen / 100))).toFixed(2));
        const factorNeto = precioUnitario > 0
          ? Number((((1 - (descuento / 100)) * (1 - (descuentoGlobalOrigen / 100))) || 0).toFixed(6))
          : 0;

        let cantidadVinculo = cantidad;
        let cantidadDestino = cantidad;
        let precioUnitarioDestino = precioUnitario;
        let subtotalPartida = subtotalPartidaDefault;

        if (esBonificacion) {
          if (montoBonificacion <= 0) {
            throw new ServiceError("MONTO_INVALIDO", "El monto bonificado debe ser mayor a cero", 400);
          }
          if (precioUnitario <= 0 || factorNeto <= 0) {
            throw new ServiceError("BONIFICACION_INVALIDA", "La partida origen no permite calcular bonificaciones por monto", 400);
          }
          cantidadVinculo = Number((montoBonificacion / (precioUnitario * factorNeto)).toFixed(6));
          cantidadDestino = 1;
          precioUnitarioDestino = Number(montoBonificacion.toFixed(2));
          subtotalPartida = Number(montoBonificacion.toFixed(2));
        }

        if (cantidadVinculo > cantidadDisponible + 0.000001) {
          throw new ServiceError("CANTIDAD_INVALIDA", "La cantidad o monto excede lo disponible en la factura origen", 400, {
            partida_origen_id: Number(partidaOrigen.partida_id),
            cantidad_disponible: cantidadDisponible,
            cantidad_solicitada: cantidadVinculo,
          });
        }

        console.log("[GenDoc] partida base", {
          documento_origen_id: partidaOrigen.documento_id,
          documento_destino_id: documentoDestino.id,
          partida_origen_id: partidaOrigen.partida_id,
          cantidad: cantidadDestino,
          cantidadVinculo,
          precioUnitario: precioUnitarioDestino,
          descuento,
          descuento_global: descuentoGlobalDocumento,
          subtotalPartida,
        });

        const { rows: partidaInsertRows } = await client.query(
          `INSERT INTO documentos_partidas (
              documento_id,
              numero_partida,
              producto_id,
              descripcion_alterna,
              cantidad,
              precio_unitario,
              descuento,
              subtotal_partida,
              total_partida
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id`,
          [
            documentoDestino.id,
            idx + 1,
            partidaOrigen.producto_id ?? null,
            esBonificacion ? (partidaOrigen.descripcion_alterna ?? `Bonificacion sobre ${buildFolio(partidaOrigen.documento_serie, partidaOrigen.documento_numero) ?? 'factura'}`) : null,
            cantidadDestino,
            precioUnitarioDestino,
            esBonificacion ? 0 : descuento,
            subtotalPartida,
            0, // total_partida lo calculará calcularImpuestosPartida
          ]
        );

        const partidaDestinoId = partidaInsertRows[0].id as number;
        partidasGeneradas.push({
          partida_destino_id: partidaDestinoId,
          partida_origen_id: Number(partidaOrigen.partida_id),
          cantidad: cantidadVinculo,
        });

        await client.query(
          `INSERT INTO documentos_partidas_vinculos (
              empresa_id,
              documento_origen_id,
              documento_destino_id,
              partida_origen_id,
              partida_destino_id,
              cantidad,
              usuario_creacion_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            empresaId,
            partidaOrigen.documento_id,
            documentoDestino.id,
            partidaOrigen.partida_id,
            partidaDestinoId,
            cantidadVinculo,
            usuarioId ?? null,
          ]
        );

        // Calcular impuestos con el motor nuevo (misma transacción)
        await calcularImpuestosPartida(partidaDestinoId, client);
      }

      // Recalcular totales del documento destino usando los valores actualizados por el motor
      await actualizarTotales(documentoDestino.id, client);

      // Obtener totales ya recalculados para la respuesta
      const { rows: totalesRows } = await client.query(
        `SELECT subtotal, iva, total
           FROM documentos
          WHERE id = $1
          LIMIT 1`,
        [documentoDestino.id]
      );

      const totales = totalesRows[0] || { subtotal: 0, iva: 0, total: 0 };

      console.log("[GenDoc] totales recalculados", {
        documento_destino_id: documentoDestino.id,
        subtotal: Number(totales.subtotal),
        iva: Number(totales.iva),
        total: Number(totales.total),
      });

      if (tipo_documento_destino === "factura" && !esConsolidado) {
        const { rows: oportunidadRows } = await client.query(
          `SELECT o.id
             FROM documentos d
             JOIN crm.oportunidades_venta o
               ON o.empresa_id = d.empresa_id
              AND (
                o.id = d.oportunidad_id
                OR o.cotizacion_principal_id = d.id
              )
            WHERE d.id = $1
            ORDER BY CASE WHEN o.id = d.oportunidad_id THEN 0 ELSE 1 END
            LIMIT 1`,
          [documentoOrigen.id]
        );

        const oportunidadId = oportunidadRows[0]?.id;
        if (oportunidadId) {
          await aplicarConversionComercialDesdeCotizacion(documentoOrigen.id, oportunidadId, client);
        }
      }

      await client.query("COMMIT");

      return {
        documento_destino_id: Number(documentoDestino.id),
        tipo_documento_destino,
        folio: buildFolio(documentoDestino.serie, documentoDestino.numero),
        subtotal: Number(totales.subtotal ?? 0),
        iva: Number(totales.iva ?? 0),
        total: Number(totales.total ?? 0),
        partidas: partidasGeneradas,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      if (error instanceof ServiceError) throw error;
      if ((error as Error)?.message?.startsWith("VALIDATION_ERROR:")) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          (error as Error).message.replace("VALIDATION_ERROR:", "").trim() || "Error de validación",
          400
        );
      }
      throw new ServiceError("ERROR_GENERICO", (error as Error)?.message ?? "Error al generar documento", 500);
    } finally {
      client.release();
    }
  }
}

export { ServiceError };
