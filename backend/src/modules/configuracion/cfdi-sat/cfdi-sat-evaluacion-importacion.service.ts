import { prepararImportacionCompras } from './cfdi-sat-compras-import.service';
import { buscarContactosPorRfc } from './cfdi-sat-proveedor.repository';
import {
  buscarDocumentoPorUuidOrigen,
  buscarPosibleDocumentoExistente,
  obtenerContactoDeDocumento,
  type PosibleDocumentoExistente,
} from './cfdi-sat-conciliacion.repository';
import { type CfdiSatComprobanteRow } from './cfdi-sat-comprobantes.repository';
import { CfdiSatValidacionError } from './cfdi-sat.shared';

/**
 * Estado operativo de importación (Fase 10): una clasificación de solo
 * lectura, calculada al vuelo, que le dice al usuario POR QUÉ un comprobante
 * está o no listo para importarse a Compras. Nunca escribe nada en base de
 * datos ni crea/modifica proveedores o documentos.
 */
export type EstadoImportacionOperativo =
  | 'importado'
  | 'listo_para_importar'
  | 'sin_xml'
  | 'cancelado'
  | 'proveedor_no_encontrado'
  | 'proveedor_duplicado'
  | 'proveedor_tipo_invalido'
  | 'impuestos_no_mapeados'
  | 'rfc_receptor_no_coincide'
  | 'uuid_ya_existe_en_documentos'
  | 'no_aplica';

export interface EvaluacionImportacion {
  comprobante_id: number;
  uuid: string;
  elegible_importacion: boolean;
  estado_importacion_operativo: EstadoImportacionOperativo;
  mensaje: string;
  documento_id: number | null;
  proveedor_id: number | null;
  proveedor_nombre: string | null;
  posible_documento_existente: PosibleDocumentoExistente | null;
}

/** Mapea el `code` de CfdiSatValidacionError (ver cfdi-sat-compras-import.service.ts) al estado operativo. */
function estadoDesdeCodigoError(code: string | undefined): EstadoImportacionOperativo {
  switch (code) {
    case 'PROVEEDOR_NO_ENCONTRADO':
      return 'proveedor_no_encontrado';
    case 'PROVEEDOR_DUPLICADO':
      return 'proveedor_duplicado';
    case 'PROVEEDOR_TIPO_INVALIDO':
      return 'proveedor_tipo_invalido';
    case 'IMPUESTOS_NO_MAPEADOS':
      return 'impuestos_no_mapeados';
    case 'RFC_RECEPTOR_NO_COINCIDE':
      return 'rfc_receptor_no_coincide';
    case 'XML_INVALIDO':
      return 'sin_xml';
    default:
      // No debería ocurrir con los códigos que hoy lanza prepararImportacionCompras;
      // se deja como red de seguridad para no tumbar la evaluación de todo el resto de la página.
      return 'no_aplica';
  }
}

function base(comprobante: CfdiSatComprobanteRow): Pick<EvaluacionImportacion, 'comprobante_id' | 'uuid'> {
  return { comprobante_id: comprobante.id, uuid: comprobante.uuid };
}

/**
 * Evalúa el estado operativo de importación de UN comprobante, sin escribir
 * nada en base de datos. Pensado para llamarse solo sobre comprobantes ya
 * paginados (nunca sobre el listado completo) — ver cfdi-sat-comprobantes.controller.ts.
 */
export async function evaluarEstadoImportacion(
  comprobante: CfdiSatComprobanteRow,
  empresaId: number
): Promise<EvaluacionImportacion> {
  // 1. Fuera de alcance: solo se evalúan CFDIs recibidos tipo Ingreso (I).
  if (comprobante.tipo_descarga !== 'recibidos' || comprobante.tipo_comprobante !== 'I') {
    return {
      ...base(comprobante),
      elegible_importacion: false,
      estado_importacion_operativo: 'no_aplica',
      mensaje: 'Solo se evalúan comprobantes recibidos de tipo Ingreso (I).',
      documento_id: null,
      proveedor_id: null,
      proveedor_nombre: null,
      posible_documento_existente: null,
    };
  }

  // 2. Ya importado por este mismo módulo (camino normal).
  if (comprobante.importado_compras && comprobante.documento_id) {
    const relacionado = await obtenerContactoDeDocumento(comprobante.documento_id);
    return {
      ...base(comprobante),
      elegible_importacion: false,
      estado_importacion_operativo: 'importado',
      mensaje: 'Ya fue importado a Compras.',
      documento_id: comprobante.documento_id,
      proveedor_id: relacionado?.proveedor_id ?? null,
      proveedor_nombre: relacionado?.proveedor_nombre ?? null,
      posible_documento_existente: null,
    };
  }

  // 3. Red de seguridad: existe un documento con este UUID de origen aunque el
  //    comprobante no esté marcado como importado (estado inconsistente, pero
  //    igual debe bloquear un doble intento de importación).
  const documentoPorUuid = await buscarDocumentoPorUuidOrigen(empresaId, comprobante.uuid);
  if (documentoPorUuid) {
    return {
      ...base(comprobante),
      elegible_importacion: false,
      estado_importacion_operativo: 'uuid_ya_existe_en_documentos',
      mensaje: 'Ya existe una factura de compra con este UUID.',
      documento_id: documentoPorUuid.documento_id,
      proveedor_id: documentoPorUuid.proveedor_id,
      proveedor_nombre: documentoPorUuid.proveedor_nombre,
      posible_documento_existente: null,
    };
  }

  // 4. Cancelado ante el SAT: nunca importable.
  if (comprobante.estatus_sat === 'cancelado') {
    return {
      ...base(comprobante),
      elegible_importacion: false,
      estado_importacion_operativo: 'cancelado',
      mensaje: 'El CFDI está cancelado ante el SAT.',
      documento_id: null,
      proveedor_id: null,
      proveedor_nombre: null,
      posible_documento_existente: null,
    };
  }

  // 5. Sin XML disponible (solicitud de tipo metadata): no se puede completar
  //    la evaluación de impuestos/RFC receptor, pero sí se puede dar una señal
  //    de proveedor y de posible duplicado con lo que ya se tiene en BD.
  if (!comprobante.xml_path) {
    const [candidatos, posibleDuplicado] = await Promise.all([
      buscarContactosPorRfc(empresaId, comprobante.rfc_emisor),
      buscarPosibleDocumentoExistente(empresaId, {
        rfcEmisor: comprobante.rfc_emisor,
        total: comprobante.total != null ? Number(comprobante.total) : null,
        fecha: comprobante.fecha_emision,
      }),
    ]);
    const proveedor = candidatos.length === 1 ? candidatos[0] : null;

    return {
      ...base(comprobante),
      elegible_importacion: false,
      estado_importacion_operativo: 'sin_xml',
      mensaje:
        'Este comprobante no tiene XML disponible (la solicitud fue de tipo metadata); no se puede completar la evaluación ni importar.',
      documento_id: null,
      proveedor_id: proveedor?.id ?? null,
      proveedor_nombre: proveedor?.nombre ?? null,
      posible_documento_existente: posibleDuplicado,
    };
  }

  // 6. Tenemos XML: reutiliza exactamente la misma validación que usa la
  //    importación real (previsualización/POST), para que la evaluación nunca
  //    se desalinee de lo que realmente pasaría al importar.
  try {
    const { parsedCfdi, proveedor } = await prepararImportacionCompras(comprobante, empresaId);

    let numeroExterno: number | null = null;
    if (parsedCfdi.folio) {
      const folioParseado = parseInt(parsedCfdi.folio, 10);
      numeroExterno = Number.isFinite(folioParseado) ? folioParseado : null;
    }

    const posibleDuplicado = await buscarPosibleDocumentoExistente(empresaId, {
      rfcEmisor: parsedCfdi.rfcEmisor,
      serieExterna: parsedCfdi.serie,
      numeroExterno,
      total: parsedCfdi.total,
      fecha: parsedCfdi.fecha,
    });

    return {
      ...base(comprobante),
      elegible_importacion: true,
      estado_importacion_operativo: 'listo_para_importar',
      mensaje: 'Listo para importar a Compras.',
      documento_id: null,
      proveedor_id: proveedor.id,
      proveedor_nombre: proveedor.nombre,
      posible_documento_existente: posibleDuplicado,
    };
  } catch (error: any) {
    if (error instanceof CfdiSatValidacionError) {
      return {
        ...base(comprobante),
        elegible_importacion: false,
        estado_importacion_operativo: estadoDesdeCodigoError(error.code),
        mensaje: error.message,
        documento_id: null,
        proveedor_id: null,
        proveedor_nombre: null,
        posible_documento_existente: null,
      };
    }

    // Error inesperado (ej. falla de BD puntual): no tumbar la evaluación de
    // toda la página por un solo comprobante, pero dejarlo claramente marcado.
    console.error('[CFDI SAT] Error inesperado al evaluar estado de importación', {
      comprobanteId: comprobante.id,
      message: error?.message,
    });
    return {
      ...base(comprobante),
      elegible_importacion: false,
      estado_importacion_operativo: 'no_aplica',
      mensaje: 'No se pudo evaluar este comprobante por un error interno.',
      documento_id: null,
      proveedor_id: null,
      proveedor_nombre: null,
      posible_documento_existente: null,
    };
  }
}

/** Evalúa varios comprobantes en paralelo. Pensado para llamarse solo con la página actual (ver Alcance 5, Fase 10). */
export async function evaluarEstadoImportacionLote(
  comprobantes: CfdiSatComprobanteRow[],
  empresaId: number
): Promise<EvaluacionImportacion[]> {
  return Promise.all(comprobantes.map((comprobante) => evaluarEstadoImportacion(comprobante, empresaId)));
}
