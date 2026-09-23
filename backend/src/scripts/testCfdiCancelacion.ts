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
  clasificarResultadoSat,
  construirExpresionImpresa,
  consultarCfdiSat,
  extraerDatosConsultaDesdeXml,
  parsearRespuestaSat,
  obtenerProveedorStatusSat,
} from '../modules/cfdi/sat-consulta.service';

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
assert.equal(interpretarResultadoReconciliacionSat('Vigente', { EstatusCancelacion: 'Pendiente' }), 'pendiente');
assert.equal(interpretarResultadoReconciliacionSat('Vigente', { EstatusCancelacion: 'No solicitada' }), 'no_solicitada');
assert.equal(interpretarResultadoReconciliacionSat('Vigente', { IsCancelable: 'Cancelable con aceptación' }), 'requiere_reconciliacion');
assert.equal(interpretarResultadoReconciliacionSat('Cancelado'), 'cancelada');
assert.equal(interpretarResultadoReconciliacionSat('rejected'), 'rechazada');
assert.equal(interpretarResultadoReconciliacionSat('No Encontrado'), 'requiere_reconciliacion');
assert.equal(esSolicitudCancelacionActiva('pendiente'), true);
assert.equal(esSolicitudCancelacionActiva('requiere_reconciliacion'), true);
assert.equal(esSolicitudCancelacionActiva('rechazada'), false);

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

const xmlCompleto = xml.replace('<cfdi:Comprobante ', '<cfdi:Comprobante Sello="SELLO_DIGITAL_DE_PRUEBA_1234567890" ');
const consulta = extraerDatosConsultaDesdeXml(xmlCompleto, UUID);
assert.equal(consulta.total, '10440.00');
assert.match(construirExpresionImpresa(consulta), /fe=34567890/);

const soap = (codigo: string, estado: string, cancelacion = '') => `<x:Envelope xmlns:x="http://schemas.xmlsoap.org/soap/envelope/"><x:Body><ConsultaResponse xmlns="http://tempuri.org/"><ConsultaResult xmlns:a="urn:test"><a:CodigoEstatus>${codigo}</a:CodigoEstatus><a:Estado>${estado}</a:Estado><a:EsCancelable>Cancelable sin aceptación</a:EsCancelable><a:EstatusCancelacion>${cancelacion}</a:EstatusCancelacion><a:ValidacionEFOS>200</a:ValidacionEFOS></ConsultaResult></ConsultaResponse></x:Body></x:Envelope>`;
const cases = [
  ['Vigente sin solicitud', 'S - Comprobante obtenido satisfactoriamente.', 'Vigente', '', 'no_solicitada'],
  ['Vigente en proceso', 'S - Comprobante obtenido satisfactoriamente.', 'Vigente', 'En proceso', 'pendiente'],
  ['Solicitud rechazada', 'S - Comprobante obtenido satisfactoriamente.', 'Vigente', 'Solicitud rechazada', 'rechazada'],
  ['Plazo vencido', 'S - Comprobante obtenido satisfactoriamente.', 'Vigente', 'Plazo vencido', 'requiere_reconciliacion'],
  ['Cancelado', 'S - Comprobante obtenido satisfactoriamente.', 'Cancelado', '', 'cancelada'],
  ['601', 'N - 601: La expresión impresa proporcionada no es válida.', 'No Encontrado', '', 'requiere_reconciliacion'],
  ['602', 'N - 602: Comprobante no encontrado.', 'No Encontrado', '', 'requiere_reconciliacion'],
] as const;
for (const [name, codigo, estado, estatus, expected] of cases) {
  const parsed = parsearRespuestaSat(soap(codigo, estado, estatus));
  assert.equal(clasificarResultadoSat(parsed), expected, name);
  assert.ok((obtenerProveedorStatusSat(parsed) ?? '').length <= 40, `${name}: proveedor_status excede varchar(40)`);
}
const respuestaLarga = parsearRespuestaSat(soap('S - Comprobante obtenido satisfactoriamente.', 'Vigente'));
assert.equal(respuestaLarga.codigoEstatus, 'S - Comprobante obtenido satisfactoriamente.');
assert.ok(respuestaLarga.codigoEstatus.length > 40);
assert.equal(obtenerProveedorStatusSat(respuestaLarga), 'Vigente');
assert.rejects(() => consultarCfdiSat(consulta, { timeoutMs: 1, transport: async (_body, signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })) )) }));
assert.throws(() => parsearRespuestaSat('<invalid/>'), /ConsultaResult/);
assert.equal(parsearRespuestaSat(soap('S - Comprobante obtenido satisfactoriamente.', 'Vigente')).esCancelable, 'Cancelable sin aceptación');
console.log(JSON.stringify({
  rutas: 'ok', estados: 'ok', xml_soap_namespaces: 'ok', respuesta_invalida: 'ok', timeout: 'ok', solicitudes_http_reales: 0,
}));
