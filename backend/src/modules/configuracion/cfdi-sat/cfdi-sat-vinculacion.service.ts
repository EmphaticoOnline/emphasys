import pool from '../../../config/database';
import { normalizeRFC } from '../../../shared/normalizers/rfc';
import {
  bloquearDocumentoParaVinculacion,
  listarCandidatosVinculacion,
  type CandidatoVinculacion,
  type CriteriosDuplicado,
} from './cfdi-sat-conciliacion.repository';
import { bloquearComprobantePorId, marcarComprobanteImportado, type CfdiSatComprobanteRow } from './cfdi-sat-comprobantes.repository';
import { parseCfdiXmlCompras } from './cfdi-sat-compras-xml-parser';
import { leerArchivoPrivado } from './cfdi-sat-storage';
import { CfdiSatValidacionError } from './cfdi-sat.shared';

const TOLERANCIA_TOTAL = 0.01;
const CODIGO_UNIQUE_VIOLATION = '23505';

/**
 * Arma los criterios de búsqueda (RFC, total, fecha, y serie/folio si el XML
 * está disponible) a partir de un comprobante ya descargado. Si el XML no se
 * puede leer o parsear, cae de vuelta a la metadata ya guardada en BD — igual
 * que la evaluación operativa de importación (Fase 10).
 */
async function construirCriteriosDesdeComprobante(comprobante: CfdiSatComprobanteRow): Promise<CriteriosDuplicado> {
  if (comprobante.xml_path) {
    try {
      const xmlBuffer = await leerArchivoPrivado(comprobante.xml_path);
      const parsedCfdi = parseCfdiXmlCompras(xmlBuffer.toString('utf8'));

      let numeroExterno: number | null = null;
      if (parsedCfdi.folio) {
        const folioParseado = parseInt(parsedCfdi.folio, 10);
        numeroExterno = Number.isFinite(folioParseado) ? folioParseado : null;
      }

      return {
        rfcEmisor: parsedCfdi.rfcEmisor,
        serieExterna: parsedCfdi.serie,
        numeroExterno,
        total: parsedCfdi.total,
        fecha: parsedCfdi.fecha,
      };
    } catch {
      // XML corrupto o ilegible: se ignora y se usa la metadata ya guardada.
    }
  }

  return {
    rfcEmisor: comprobante.rfc_emisor,
    total: comprobante.total != null ? Number(comprobante.total) : null,
    fecha: comprobante.fecha_emision,
  };
}

/** Lista candidatos de vinculación para un comprobante ya descargado (Fase 11, Alcance 2). */
export async function listarCandidatosParaComprobante(
  comprobante: CfdiSatComprobanteRow,
  empresaId: number
): Promise<CandidatoVinculacion[]> {
  const criterios = await construirCriteriosDesdeComprobante(comprobante);
  return listarCandidatosVinculacion(empresaId, criterios, 10);
}

export interface VinculacionResultado {
  documentoId: number;
  comprobanteId: number;
  uuid: string;
  proveedorId: number | null;
  proveedorNombre: string | null;
}

function validarComprobanteVinculable(comprobante: CfdiSatComprobanteRow): void {
  if (comprobante.tipo_descarga !== 'recibidos' || comprobante.tipo_comprobante !== 'I') {
    throw new CfdiSatValidacionError('Solo se pueden vincular comprobantes recibidos de tipo Ingreso (I)');
  }
  if (comprobante.importado_compras) {
    throw new CfdiSatValidacionError('Este comprobante ya fue importado o vinculado a una factura de compra');
  }
  if (comprobante.estatus_sat === 'cancelado') {
    throw new CfdiSatValidacionError('No se puede vincular un comprobante cancelado ante el SAT');
  }
  if (!comprobante.uuid) {
    throw new CfdiSatValidacionError('El comprobante no tiene un UUID válido');
  }
}

const ESTATUS_CANCELADO = new Set(['cancelado', 'cancelada']);

/**
 * Vincula un comprobante SAT ya descargado con una factura de compra
 * capturada manualmente, SIN crear ningún documento nuevo. Corre dentro de su
 * propia transacción con lock de fila en ambos (comprobante y documento) para
 * evitar condiciones de carrera (doble clic, dos usuarios a la vez).
 */
export async function vincularComprobanteADocumento(params: {
  comprobanteId: number;
  documentoId: number;
  empresaId: number;
  usuarioId: number;
}): Promise<VinculacionResultado> {
  const { comprobanteId, documentoId, empresaId } = params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const comprobante = await bloquearComprobantePorId(comprobanteId, empresaId, client);
    if (!comprobante) {
      throw new CfdiSatValidacionError('Comprobante no encontrado', 404);
    }
    validarComprobanteVinculable(comprobante);

    const documento = await bloquearDocumentoParaVinculacion(documentoId, empresaId, client);
    if (!documento) {
      throw new CfdiSatValidacionError('Documento no encontrado', 404);
    }
    if (String(documento.tipo_documento).toLowerCase() !== 'factura_compra') {
      throw new CfdiSatValidacionError('El documento seleccionado no es una factura de compra');
    }
    if (ESTATUS_CANCELADO.has(String(documento.estatus_documento).trim().toLowerCase())) {
      throw new CfdiSatValidacionError('No se puede vincular un documento cancelado');
    }
    if (documento.uuid_cfdi_origen) {
      throw new CfdiSatValidacionError(
        documento.uuid_cfdi_origen === comprobante.uuid
          ? 'Este documento ya está vinculado a este mismo CFDI'
          : 'El documento seleccionado ya está vinculado a otro CFDI del SAT',
        409,
        'DOCUMENTO_YA_VINCULADO'
      );
    }

    const rfcComprobante = normalizeRFC(comprobante.rfc_emisor);
    const rfcDocumento = normalizeRFC(documento.contacto_rfc);
    if (rfcComprobante && rfcDocumento && rfcComprobante !== rfcDocumento) {
      throw new CfdiSatValidacionError(
        `El RFC emisor del CFDI (${comprobante.rfc_emisor}) no coincide con el RFC del proveedor de la factura (${documento.contacto_rfc ?? 'sin RFC registrado'})`
      );
    }

    const totalComprobante = comprobante.total != null ? Number(comprobante.total) : null;
    const totalDocumento = documento.total != null ? Number(documento.total) : null;
    if (
      totalComprobante != null &&
      totalDocumento != null &&
      Math.abs(totalComprobante - totalDocumento) > TOLERANCIA_TOTAL
    ) {
      throw new CfdiSatValidacionError(
        `El total del CFDI (${totalComprobante.toFixed(2)}) no coincide con el total de la factura (${totalDocumento.toFixed(2)})`
      );
    }

    // Serie/folio: solo se valida si el XML del CFDI los trae Y la factura tiene serie/folio externos capturados.
    if (comprobante.xml_path) {
      try {
        const xmlBuffer = await leerArchivoPrivado(comprobante.xml_path);
        const parsedCfdi = parseCfdiXmlCompras(xmlBuffer.toString('utf8'));
        let folioXml: number | null = null;
        if (parsedCfdi.folio) {
          const folioParseado = parseInt(parsedCfdi.folio, 10);
          folioXml = Number.isFinite(folioParseado) ? folioParseado : null;
        }

        const hayDatosCfdi = Boolean(parsedCfdi.serie) || folioXml != null;
        const hayDatosDocumento = Boolean(documento.serie_externa) || documento.numero_externo != null;

        if (hayDatosCfdi && hayDatosDocumento) {
          const serieCoincide = (parsedCfdi.serie ?? null) === (documento.serie_externa ?? null);
          const folioCoincide = (folioXml ?? null) === (documento.numero_externo ?? null);
          if (!serieCoincide || !folioCoincide) {
            throw new CfdiSatValidacionError(
              'La serie/folio del CFDI no coincide con la serie/folio externos de la factura seleccionada'
            );
          }
        }
      } catch (error) {
        if (error instanceof CfdiSatValidacionError) throw error;
        // XML corrupto/ilegible: no se puede validar serie/folio, pero no bloquea la vinculación por eso.
      }
    }

    await client.query(`UPDATE documentos SET uuid_cfdi_origen = $1 WHERE id = $2`, [comprobante.uuid, documento.id]);
    await marcarComprobanteImportado(comprobante.id, documento.id, client);

    await client.query('COMMIT');

    return {
      documentoId: documento.id,
      comprobanteId: comprobante.id,
      uuid: comprobante.uuid,
      proveedorId: documento.contacto_principal_id,
      proveedorNombre: documento.contacto_nombre,
    };
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});

    if (error?.code === CODIGO_UNIQUE_VIOLATION) {
      throw new CfdiSatValidacionError(
        'Ya existe una factura de compra vinculada con este UUID (duplicado)',
        409,
        'DOCUMENTO_YA_VINCULADO'
      );
    }
    throw error;
  } finally {
    client.release();
  }
}
