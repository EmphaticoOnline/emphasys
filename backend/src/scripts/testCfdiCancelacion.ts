import assert from 'node:assert/strict';
import {
  esUuidFiscal,
  esSolicitudCancelacionActiva,
  getCancelPath,
  getApiLiteCancelPath,
  getApiWebCancelPath,
  getCfdiStatusPath,
  interpretarEstadoCancelacionFacturama,
  interpretarEstadoSatCfdi,
  interpretarResultadoReconciliacionSat,
  validarIdentidadCfdiOriginal,
} from '../modules/cfdi/cfdi-cancelacion';
import {
  clasificarFalloCancelacionPac,
  consultarEstadoSatPac,
} from '../modules/documentos/documentos-cancel.service';

const PAC_ID = 'abc_DEF-123';
const UUID = 'ca05cd78-e0d4-49d1-8415-c9e2c6ed143b';
const xml = `<?xml version="1.0"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Folio="12" Total="10440.00">
  <cfdi:Emisor Rfc="AAA010101AAA"/>
  <cfdi:Receptor Rfc="BBB010101BBB"/>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="${UUID}"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

assert.equal(
  getApiLiteCancelPath(PAC_ID, '02'),
  '/api-lite/cfdis/abc_DEF-123?motive=02'
);
assert.equal(
  getApiWebCancelPath(PAC_ID, '01', UUID),
  `/cfdi/abc_DEF-123?type=issued&motive=01&uuidReplacement=${UUID}`
);
assert.throws(() => getApiLiteCancelPath('', '02'), /falta el identificador/i);
assert.throws(() => getApiWebCancelPath(UUID, '02'), /no puede ser el UUID/i);
assert.throws(() => getCancelPath('unknown' as any, PAC_ID, '02'), /modalidad.*desconocida/i);
assert.equal(esUuidFiscal(UUID), true);
assert.equal(getCfdiStatusPath('web', PAC_ID), '/cfdi/abc_DEF-123?type=issued');
assert.equal(getCfdiStatusPath('lite', PAC_ID), '/api-lite/cfdis/abc_DEF-123');

assert.equal(interpretarEstadoCancelacionFacturama('canceled'), 'cancelada');
assert.equal(interpretarEstadoCancelacionFacturama('pending'), 'pendiente');
assert.equal(interpretarEstadoCancelacionFacturama('requested'), 'pendiente');
assert.equal(interpretarEstadoCancelacionFacturama('rejected'), 'rechazada');
assert.equal(interpretarEstadoCancelacionFacturama('unexpected'), 'requiere_reconciliacion');
assert.equal(interpretarEstadoSatCfdi('Vigente'), 'vigente');
assert.equal(interpretarEstadoSatCfdi('Cancelado'), 'cancelado');
assert.equal(interpretarEstadoSatCfdi('No Encontrado'), 'no_encontrado');
assert.equal(interpretarEstadoSatCfdi('unexpected'), 'desconocido');
assert.equal(interpretarResultadoReconciliacionSat('Vigente'), 'pendiente');
assert.equal(interpretarResultadoReconciliacionSat('Cancelado'), 'cancelada');
assert.equal(interpretarResultadoReconciliacionSat('rejected'), 'rechazada');
assert.equal(interpretarResultadoReconciliacionSat('No Encontrado'), 'requiere_reconciliacion');
assert.equal(esSolicitudCancelacionActiva('pendiente'), true);
assert.equal(esSolicitudCancelacionActiva('requiere_reconciliacion'), true);
assert.equal(esSolicitudCancelacionActiva('rechazada'), false);

assert.deepEqual(
  clasificarFalloCancelacionPac({
    requestDispatched: true,
    hasPacResponse: false,
    transportCode: 'ETIMEDOUT',
  }),
  {
    estado: 'requiere_reconciliacion',
    code: 'ETIMEDOUT',
    message: 'No fue posible confirmar el estado fiscal; la solicitud requiere conciliación antes de cualquier reintento.',
    pacResponse: null,
  }
);
const rejected = clasificarFalloCancelacionPac({
  requestDispatched: true,
  hasPacResponse: true,
  statusCode: 404,
  message: 'CFDI no encontrado',
  facturamaResponse: {
    Message: 'CFDI no encontrado',
    secret: 'no debe persistirse',
  },
});
assert.equal(rejected.estado, 'error');
assert.equal(rejected.code, '404');
assert.deepEqual(rejected.pacResponse, { Message: 'CFDI no encontrado' });

validarIdentidadCfdiOriginal({
  xml,
  uuid: UUID,
  rfcEmisor: 'AAA010101AAA',
  rfcReceptor: 'BBB010101BBB',
  total: 10440,
  folio: 12,
});
assert.throws(
  () => validarIdentidadCfdiOriginal({
    xml,
    uuid: UUID,
    rfcEmisor: 'CCC010101CCC',
  }),
  /RFC emisor almacenado no coincide/i
);

const reconciliationCalls: string[] = [];
consultarEstadoSatPac({
  async getSatCfdiStatus(payload) {
    reconciliationCalls.push(`GET:${payload.uuid}:${payload.issuerRfc}:${payload.receiverRfc}:${payload.total}`);
    return {
      data: { Status: 'Vigente' },
      endpoint: '/cfdi/status',
      httpStatus: 200,
      status: 'Vigente',
    };
  },
}, {
  uuid: UUID,
  issuerRfc: 'AAA010101AAA',
  receiverRfc: 'BBB010101BBB',
  total: 10440,
}).then(() => {
  assert.deepEqual(reconciliationCalls, [`GET:${UUID}:AAA010101AAA:BBB010101BBB:10440`]);
  console.log(JSON.stringify({
    rutas: 'ok',
    pac_id_requerido: 'ok',
    uuid_como_pac_id: 'bloqueado',
    estados: 'ok',
    solicitud_duplicada: 'bloqueada_por_estado_activo',
    identidad_xml: 'ok',
    reconciliacion_cliente_simulado: 'solo_get',
    solicitudes_http_reales: 0,
  }));
});
