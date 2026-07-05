import type { PoolClient } from 'pg';
import pool from '../../../config/database';
import { normalizeRFC } from '../../../shared/normalizers/rfc';
import { obtenerEmpresaPorId } from '../../../services/empresasService';
import { crearDocumentoRepository, agregarPartidaRepository } from '../../documentos/documentos.repository';
import { insertarImpuestosDePartida } from '../../impuestos/impuestos.repository';
import { parseCfdiXmlCompras, type CfdiComprasParseado, type CfdiConceptoImpuesto } from './cfdi-sat-compras-xml-parser';
import { buscarContactosPorRfc, type ContactoCandidato } from './cfdi-sat-proveedor.repository';
import { buscarImpuestoPorTipoYTasa, type ImpuestoCatalogoMatch } from './cfdi-sat-impuestos.repository';
import { leerArchivoPrivado } from './cfdi-sat-storage';
import { marcarComprobanteImportado } from './cfdi-sat-comprobantes.repository';
import { type CfdiSatComprobanteRow } from './cfdi-sat-comprobantes.repository';
import { CfdiSatValidacionError } from './cfdi-sat.shared';

const TIPOS_CONTACTO_PROVEEDOR = new Set(['Proveedor', 'Varios']);
const CODIGO_UNIQUE_VIOLATION = '23505';

function validarElegibilidad(comprobante: CfdiSatComprobanteRow): void {
  if (comprobante.tipo_descarga !== 'recibidos') {
    throw new CfdiSatValidacionError('Solo se pueden importar comprobantes recibidos');
  }
  if (comprobante.tipo_comprobante !== 'I') {
    throw new CfdiSatValidacionError('Solo se pueden importar comprobantes de tipo Ingreso (I)');
  }
  if (comprobante.importado_compras) {
    throw new CfdiSatValidacionError('Este comprobante ya fue importado a compras');
  }
  if (!comprobante.xml_path) {
    throw new CfdiSatValidacionError('Este comprobante no tiene XML disponible (la solicitud fue de tipo metadata)');
  }
  if (comprobante.estatus_sat === 'cancelado') {
    throw new CfdiSatValidacionError('No se puede importar un comprobante cancelado ante el SAT');
  }
}

function claveImpuesto(tipo: string, tasa: number): string {
  return `${tipo.toLowerCase()}:${tasa.toFixed(6)}`;
}

/**
 * Resuelve, contra el catálogo interno de impuestos (public.impuestos), cada
 * combinación distinta de tipo+tasa que aparece en los conceptos del CFDI.
 *
 * Deliberadamente estricto: si algún traslado/retención del XML no tiene un
 * impuesto correspondiente en el catálogo (o usa TipoFactor "Cuota" sin tasa
 * porcentual, no soportado en esta fase), se bloquea toda la importación en
 * vez de crear la factura con IVA en el encabezado pero sin el detalle en
 * documentos_partidas_impuestos — ese estado a medias es justo lo que rompería
 * la factura si alguien edita sus partidas después (actualizarTotales/
 * calcularImpuestosPartida solo leen de esa tabla, no del monto ya timbrado).
 */
async function resolverImpuestosDelCfdi(
  parsedCfdi: CfdiComprasParseado,
  executor: Pick<PoolClient, 'query'>
): Promise<Map<string, ImpuestoCatalogoMatch>> {
  const combinaciones = new Map<string, { tipo: 'traslado' | 'retencion'; tasa: number }>();
  const sinTasaPorcentual: string[] = [];

  for (const concepto of parsedCfdi.conceptos) {
    for (const impuesto of concepto.impuestos) {
      if (impuesto.tasaOCuota == null) {
        sinTasaPorcentual.push(`${impuesto.tipo} (${impuesto.impuesto ?? 'sin código'}, cuota fija)`);
        continue;
      }
      const clave = claveImpuesto(impuesto.tipo, impuesto.tasaOCuota);
      if (!combinaciones.has(clave)) {
        combinaciones.set(clave, { tipo: impuesto.tipo, tasa: impuesto.tasaOCuota });
      }
    }
  }

  const resueltos = new Map<string, ImpuestoCatalogoMatch>();
  const noResueltos: string[] = [...sinTasaPorcentual];

  for (const [clave, { tipo, tasa }] of combinaciones) {
    const match = await buscarImpuestoPorTipoYTasa(tipo, tasa, executor);
    if (match) {
      resueltos.set(clave, match);
    } else {
      noResueltos.push(`${tipo} ${(tasa * 100).toFixed(2)}%`);
    }
  }

  if (noResueltos.length > 0) {
    throw new CfdiSatValidacionError(
      `El CFDI incluye impuestos que no existen en el catálogo interno: ${noResueltos.join(', ')}. Agrega ese impuesto en el catálogo de impuestos antes de importar.`,
      422,
      'IMPUESTOS_NO_MAPEADOS'
    );
  }

  return resueltos;
}

export interface PreparacionImportacion {
  parsedCfdi: CfdiComprasParseado;
  proveedor: ContactoCandidato;
  impuestosResueltos: Map<string, ImpuestoCatalogoMatch>;
}

/**
 * Valida elegibilidad, lee y parsea el XML, valida RFC receptor contra la
 * empresa activa, resuelve el proveedor por RFC emisor y mapea los impuestos
 * del XML al catálogo interno. No escribe nada en base de datos: se usa tanto
 * para la previsualización (GET) como primer paso de la importación real
 * (POST), en ese caso ya bajo el lock de fila.
 */
export async function prepararImportacionCompras(
  comprobante: CfdiSatComprobanteRow,
  empresaId: number,
  executor: Pick<PoolClient, 'query'> = pool
): Promise<PreparacionImportacion> {
  validarElegibilidad(comprobante);

  const xmlBuffer = await leerArchivoPrivado(comprobante.xml_path as string);

  let parsedCfdi: CfdiComprasParseado;
  try {
    parsedCfdi = parseCfdiXmlCompras(xmlBuffer.toString('utf8'));
  } catch (error: any) {
    throw new CfdiSatValidacionError(
      `No se pudo leer el XML del comprobante: ${error?.message ?? 'formato inválido'}`,
      422,
      'XML_INVALIDO'
    );
  }

  if (parsedCfdi.uuid !== comprobante.uuid) {
    throw new CfdiSatValidacionError(
      'El UUID del XML no coincide con el UUID registrado del comprobante',
      422,
      'XML_INVALIDO'
    );
  }

  const empresa = await obtenerEmpresaPorId(empresaId);
  if (!empresa) {
    throw new CfdiSatValidacionError('Empresa no encontrada', 404);
  }

  if (normalizeRFC(parsedCfdi.rfcReceptor) !== normalizeRFC(empresa.rfc)) {
    throw new CfdiSatValidacionError(
      `El RFC receptor del CFDI (${parsedCfdi.rfcReceptor}) no coincide con el RFC de la empresa (${empresa.rfc})`,
      422,
      'RFC_RECEPTOR_NO_COINCIDE'
    );
  }

  const candidatos = await buscarContactosPorRfc(empresaId, parsedCfdi.rfcEmisor, executor);

  if (candidatos.length === 0) {
    throw new CfdiSatValidacionError(
      `No existe proveedor con RFC ${parsedCfdi.rfcEmisor}. Primero crea o vincula el proveedor.`,
      422,
      'PROVEEDOR_NO_ENCONTRADO'
    );
  }
  if (candidatos.length > 1) {
    throw new CfdiSatValidacionError(
      `Existen ${candidatos.length} contactos con RFC ${parsedCfdi.rfcEmisor}. Resuelve el duplicado antes de importar.`,
      422,
      'PROVEEDOR_DUPLICADO'
    );
  }

  const proveedor = candidatos[0];
  if (!TIPOS_CONTACTO_PROVEEDOR.has(proveedor.tipo_contacto)) {
    throw new CfdiSatValidacionError(
      `El contacto con RFC ${parsedCfdi.rfcEmisor} (${proveedor.nombre}) existe pero es de tipo "${proveedor.tipo_contacto}", no Proveedor. Actualiza su tipo de contacto antes de importar.`,
      422,
      'PROVEEDOR_TIPO_INVALIDO'
    );
  }

  const impuestosResueltos = await resolverImpuestosDelCfdi(parsedCfdi, executor);

  return { parsedCfdi, proveedor, impuestosResueltos };
}

type CatalogoSat = 'sat.formas_pago' | 'sat.metodos_pago' | 'sat.usos_cfdi' | 'sat.regimenes_fiscales';

/**
 * forma_pago/metodo_pago/uso_cfdi/regimen_fiscal_receptor tienen FK a catálogos
 * sat.*. Si el código del XML no está en el catálogo local, se deja en NULL en
 * vez de tumbar toda la importación por un dato secundario.
 */
async function resolverCodigoSatValido(
  client: PoolClient,
  catalogo: CatalogoSat,
  valor: string | null
): Promise<string | null> {
  if (!valor) return null;
  const { rows } = await client.query(`SELECT 1 FROM ${catalogo} WHERE id = $1 LIMIT 1`, [valor]);
  return rows.length > 0 ? valor : null;
}

/**
 * Traduce los impuestos ya parseados de un concepto al shape que espera
 * insertarImpuestosDePartida(), usando el catálogo interno ya resuelto por
 * resolverImpuestosDelCfdi(). Los montos (base/monto) se toman tal cual del
 * XML — nunca se recalculan — para no desviarse del CFDI ya timbrado; solo
 * impuesto_id/tasa vienen del catálogo interno para satisfacer la FK.
 */
function mapearImpuestosDeConcepto(
  impuestos: CfdiConceptoImpuesto[],
  impuestosResueltos: Map<string, ImpuestoCatalogoMatch>,
  subtotalPartidaFallback: number
): { impuestoId: string; tasa: number; base: number; monto: number }[] {
  return impuestos
    .filter((impuesto) => impuesto.tasaOCuota != null)
    .map((impuesto) => {
      const match = impuestosResueltos.get(claveImpuesto(impuesto.tipo, impuesto.tasaOCuota as number));
      if (!match) {
        // No debería ocurrir: resolverImpuestosDelCfdi ya bloqueó la importación si faltaba algún mapeo.
        throw new Error(`Impuesto sin resolver de forma inesperada: ${impuesto.tipo} ${impuesto.tasaOCuota}`);
      }
      return {
        impuestoId: match.id,
        tasa: match.tasa,
        base: impuesto.base ?? subtotalPartidaFallback,
        monto: impuesto.importe,
      };
    });
}

export interface ImportacionEjecutada {
  documentoId: number;
  tipoDocumento: string;
  serie: string | null;
  numero: number | null;
  serieExterna: string | null;
  numeroExterno: number | null;
  estatusDocumento: string;
  total: number;
  contactoId: number;
  contactoNombre: string;
}

/**
 * Crea la factura de compra en borrador a partir del CFDI y marca el
 * comprobante SAT como importado. Debe ejecutarse dentro de una transacción
 * cuyo `client` ya tenga el comprobante bloqueado (bloquearComprobantePorId).
 *
 * Deliberadamente NO usa agregarPartidaService/reemplazarPartidasService ni
 * actualizarTotales(): esas funciones recalculan impuestos con el motor de
 * impuestos según producto_id/tratamiento_impuestos, lo cual sobrescribiría
 * los montos reales ya timbrados en el CFDI. Se llama directamente a los
 * repositorios y se fijan subtotal/iva/total desde el XML.
 */
export async function ejecutarImportacionCompras(params: {
  comprobante: CfdiSatComprobanteRow;
  empresaId: number;
  usuarioId: number;
  client: PoolClient;
}): Promise<ImportacionEjecutada> {
  const { comprobante, empresaId, usuarioId, client } = params;

  const { parsedCfdi, proveedor, impuestosResueltos } = await prepararImportacionCompras(
    comprobante,
    empresaId,
    client
  );

  const [formaPago, metodoPago, usoCfdi, regimenFiscalReceptor] = await Promise.all([
    resolverCodigoSatValido(client, 'sat.formas_pago', parsedCfdi.formaPago),
    resolverCodigoSatValido(client, 'sat.metodos_pago', parsedCfdi.metodoPago),
    resolverCodigoSatValido(client, 'sat.usos_cfdi', parsedCfdi.usoCfdi),
    resolverCodigoSatValido(client, 'sat.regimenes_fiscales', parsedCfdi.regimenFiscalReceptor),
  ]);

  let numeroExterno: number | null = null;
  if (parsedCfdi.folio) {
    const folioParseado = parseInt(parsedCfdi.folio, 10);
    numeroExterno = Number.isFinite(folioParseado) ? folioParseado : null;
  }

  const documentoPayload = {
    contacto_principal_id: proveedor.id,
    fecha_documento: parsedCfdi.fecha ? parsedCfdi.fecha.split('T')[0] : new Date().toISOString().slice(0, 10),
    moneda: parsedCfdi.moneda,
    tipo_cambio: parsedCfdi.tipoCambio,
    subtotal: parsedCfdi.subTotal,
    descuento: parsedCfdi.descuento || null,
    iva: parsedCfdi.totalImpuestosTrasladados || null,
    total: parsedCfdi.total,
    serie_externa: parsedCfdi.serie,
    numero_externo: numeroExterno,
    rfc_receptor: parsedCfdi.rfcReceptor,
    nombre_receptor: parsedCfdi.nombreReceptor,
    regimen_fiscal_receptor: regimenFiscalReceptor,
    uso_cfdi: usoCfdi,
    forma_pago: formaPago,
    metodo_pago: metodoPago,
    codigo_postal_receptor: parsedCfdi.codigoPostalReceptor,
    tratamiento_impuestos: 'normal',
    estatus_documento: 'Borrador',
    usuario_creacion_id: usuarioId,
    observaciones: `Importado desde CFDI del SAT. UUID: ${parsedCfdi.uuid}. RFC emisor: ${parsedCfdi.rfcEmisor}.`,
  };

  const documentoCreado = await crearDocumentoRepository(documentoPayload, empresaId, 'factura_compra', client);

  try {
    await client.query(`UPDATE documentos SET uuid_cfdi_origen = $1 WHERE id = $2`, [
      parsedCfdi.uuid,
      documentoCreado.id,
    ]);
  } catch (error: any) {
    if (error?.code === CODIGO_UNIQUE_VIOLATION) {
      throw new CfdiSatValidacionError('Ya existe una factura de compra importada con este UUID (duplicado)');
    }
    throw error;
  }

  for (const concepto of parsedCfdi.conceptos) {
    const cantidad = concepto.cantidad || 1;
    const subtotalPartida = Number((concepto.importe - concepto.descuento).toFixed(2));
    const trasladosConcepto = concepto.impuestos
      .filter((impuesto) => impuesto.tipo === 'traslado')
      .reduce((acc, impuesto) => acc + impuesto.importe, 0);
    const retencionesConcepto = concepto.impuestos
      .filter((impuesto) => impuesto.tipo === 'retencion')
      .reduce((acc, impuesto) => acc + impuesto.importe, 0);
    const totalPartida = Number((subtotalPartida + trasladosConcepto - retencionesConcepto).toFixed(2));

    const notasSat =
      [
        concepto.claveProdServ ? `ClaveProdServ: ${concepto.claveProdServ}` : null,
        concepto.claveUnidad ? `ClaveUnidad: ${concepto.claveUnidad}` : null,
        concepto.unidad ? `Unidad: ${concepto.unidad}` : null,
      ]
        .filter(Boolean)
        .join(' | ') || null;

    const partidaCreada = await agregarPartidaRepository(
      documentoCreado.id,
      {
        producto_id: null,
        descripcion_alterna: concepto.descripcion,
        cantidad,
        precio_unitario: concepto.valorUnitario,
        descuento_tipo: 'monto',
        descuento_monto: concepto.descuento,
        subtotal_partida: subtotalPartida,
        total_partida: totalPartida,
        observaciones: notasSat,
      },
      empresaId,
      client
    );

    const impuestosPartida = mapearImpuestosDeConcepto(concepto.impuestos, impuestosResueltos, subtotalPartida);
    if (partidaCreada?.id && impuestosPartida.length > 0) {
      await insertarImpuestosDePartida(partidaCreada.id, impuestosPartida, client);
    }
  }

  await marcarComprobanteImportado(comprobante.id, documentoCreado.id, client);

  return {
    documentoId: documentoCreado.id,
    tipoDocumento: documentoCreado.tipo_documento,
    serie: documentoCreado.serie,
    numero: documentoCreado.numero,
    serieExterna: documentoCreado.serie_externa,
    numeroExterno: documentoCreado.numero_externo,
    estatusDocumento: documentoCreado.estatus_documento,
    total: Number(documentoCreado.total),
    contactoId: proveedor.id,
    contactoNombre: proveedor.nombre,
  };
}
