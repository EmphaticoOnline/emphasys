import assert from 'node:assert/strict';
import {
  validarFacturaRelacionadaPago,
  validarReceptorFiscalComun,
} from '../modules/cfdi/pago-complement.validation';
import { PagoComplementValidationError } from '../modules/cfdi/pago-complement.errors';
import { assertPagoTieneAplicaciones } from '../modules/cfdi/cfdi-pago.service';

const uuid = '00000000-0000-0000-0000-000000000018';
const xml = (
  method = 'PPD',
  receiver = 'BBB010101BBB',
  name = 'RECEPTOR DE PRUEBA',
  regime = '612',
  zip = '64000'
) =>
  `<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" MetodoPago="${method}">
    <cfdi:Emisor Rfc="AAA010101AAA"/>
    <cfdi:Receptor Rfc="${receiver}" Nombre="${name}" RegimenFiscalReceptor="${regime}" DomicilioFiscalReceptor="${zip}" UsoCFDI="G03"/>
    <cfdi:Complemento><tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="${uuid}"/></cfdi:Complemento>
  </cfdi:Comprobante>`;

const valid = () => ({
  documentoId: 18,
  folio: 'B-18',
  tipoDocumento: 'factura',
  empresaId: 1,
  estatusDocumento: 'Timbrado',
  tratamientoImpuestos: 'normal',
  uuid,
  xmlTimbrado: xml(),
  estadoSat: 'vigente',
  fechaCancelacion: null,
  rfcEmpresa: 'AAA010101AAA',
  rfcPago: 'BBB010101BBB',
  previousBalance: 18600,
  amountPaid: 18600,
  remainingBalance: 0,
  partialityNumber: 1,
});

assert.throws(
  () => assertPagoTieneAplicaciones([], { documentoId: 157, serie: 'PCL', numero: 1 }),
  (error: unknown) =>
    error instanceof PagoComplementValidationError &&
    error.code === 'PAYMENT_WITHOUT_APPLICATIONS' &&
    error.statusCode === 409 &&
    error.message === 'El pago PCL-001 no tiene facturas aplicadas. Aplique el pago a una factura PPD timbrada antes de generar el Complemento de Pago.'
);

assert.equal(validarFacturaRelacionadaPago(valid()).paymentMethod, 'PPD');
assert.equal(validarFacturaRelacionadaPago(valid()).receptor.rfc, 'BBB010101BBB');
assert.throws(() => validarFacturaRelacionadaPago({ ...valid(), xmlTimbrado: xml('PUE') }), /PUE/);
assert.throws(() => validarFacturaRelacionadaPago({ ...valid(), tipoDocumento: 'nota_venta' }), /no puede incluirse/);
assert.throws(() => validarFacturaRelacionadaPago({ ...valid(), tratamientoImpuestos: 'sin_iva' }), /nota de venta/);
assert.throws(() => validarFacturaRelacionadaPago({ ...valid(), uuid: null }), /no tiene UUID/);
assert.throws(() => validarFacturaRelacionadaPago({ ...valid(), xmlTimbrado: null }), /no tiene XML/);
assert.throws(() => validarFacturaRelacionadaPago({ ...valid(), estadoSat: 'cancelado' }), /vigente/);
assert.throws(() => validarFacturaRelacionadaPago({ ...valid(), fechaCancelacion: new Date() }), /vigente/);
assert.throws(() => validarFacturaRelacionadaPago({ ...valid(), rfcEmpresa: 'CCC010101CCC' }), /empresa activa/);
assert.throws(() => validarFacturaRelacionadaPago({ ...valid(), amountPaid: 18600.02 }), /excede/);
assert.throws(() => validarFacturaRelacionadaPago({ ...valid(), remainingBalance: -1 }), /negativo/);
assert.throws(() => validarFacturaRelacionadaPago({ ...valid(), remainingBalance: 1 }), /no son coherentes/);
assert.throws(
  () => validarFacturaRelacionadaPago({ ...valid(), xmlTimbrado: '<not-xml' }),
  (error: unknown) => error instanceof PagoComplementValidationError && error.code === 'RELATED_XML_INVALID'
);
assert.throws(
  () => validarFacturaRelacionadaPago({ ...valid(), xmlTimbrado: xml().replace(/<cfdi:Receptor[^>]+\/>/, '') }),
  (error: unknown) => error instanceof PagoComplementValidationError && error.code === 'RELATED_XML_INVALID'
);

const first = validarFacturaRelacionadaPago(valid()).receptor;
assert.equal(validarReceptorFiscalComun([
  { folio: 'A-1', receptor: first },
  { folio: 'A-2', receptor: { ...first, nombre: '  receptor   de prueba ' } },
]).rfc, first.rfc);
for (const receptor of [
  { ...first, rfc: 'CCC010101CCC' },
  { ...first, regimenFiscal: '601' },
  { ...first, domicilioFiscal: '06000' },
]) {
  assert.throws(
    () => validarReceptorFiscalComun([
      { folio: 'A-1', receptor: first },
      { folio: 'A-2', receptor },
    ]),
    (error: unknown) => error instanceof PagoComplementValidationError && error.code === 'RELATED_RECEIVER_MISMATCH'
  );
}

console.log('Prechecks fiscales de complemento de pago: OK (sin HTTP ni base de datos).');
