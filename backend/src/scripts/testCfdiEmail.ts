import assert from 'node:assert/strict';
import {
  CfdiEmailError,
  prepararComplementoPagoEmail,
  validarEmailDestino,
  validarXmlComplementoPago,
} from '../services/cfdi-email.service';

const UUID = 'b036e952-a0d4-4614-94d2-6acea26487f1';
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20"
  Version="4.0" Serie="PCL" Folio="3" Fecha="2026-07-28T10:00:00" LugarExpedicion="00000"
  TipoDeComprobante="P" Sello="SELLO">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Emphasys Software" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Cliente de prueba" DomicilioFiscalReceptor="00000"
    RegimenFiscalReceptor="601" UsoCFDI="CP01"/>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Totales MontoTotalPagos="18600.00"/>
      <pago20:Pago FechaPago="2026-07-28T09:00:00" FormaDePagoP="03" MonedaP="MXN" Monto="18600.00">
        <pago20:DoctoRelacionado IdDocumento="11111111-1111-1111-1111-111111111111"
          Serie="B" Folio="18" MonedaDR="MXN" NumParcialidad="1"
          ImpSaldoAnt="18600.00" ImpPagado="18600.00" ImpSaldoInsoluto="0.00"/>
      </pago20:Pago>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
      UUID="${UUID}" FechaTimbrado="2026-07-28T10:00:01"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

function assertCfdiError(fn: () => unknown, code: string) {
  assert.throws(fn, (error: unknown) => error instanceof CfdiEmailError && error.code === code);
}

assert.equal(validarEmailDestino('cliente@example.com'), 'cliente@example.com');
assertCfdiError(() => validarEmailDestino(''), 'EMAIL_REQUIRED');
assertCfdiError(() => validarEmailDestino('correo-invalido'), 'EMAIL_INVALID');

const parsed = validarXmlComplementoPago(xml, UUID);
const pdfSimulado = Buffer.from('PDF SIMULADO; NO ES UN CORREO REAL');
const prepared = prepararComplementoPagoEmail(parsed, 'PCL-003', xml, pdfSimulado);

assert.equal(prepared.subject, 'Complemento de pago PCL-003 – Emphasys Software');
assert.match(prepared.text, /Cliente de prueba/);
assert.match(prepared.text, /\$18,600\.00 MXN/);
assert.match(prepared.text, /Factura B-18/);
assert.match(prepared.html || '', /Complemento de Pago PCL-003/);
assert.deepEqual(
  prepared.attachments.map(({ filename, contentType }) => ({ filename, contentType })),
  [
    { filename: 'Complemento-Pago-PCL-003.pdf', contentType: 'application/pdf' },
    { filename: 'Complemento-Pago-PCL-003.xml', contentType: 'application/xml' },
  ]
);
assert.equal(prepared.attachments[1].content, xml, 'El XML adjunto debe conservarse sin modificaciones');

assertCfdiError(
  () => validarXmlComplementoPago(xml, '00000000-0000-0000-0000-000000000000'),
  'UUID_MISMATCH'
);
assertCfdiError(
  () => validarXmlComplementoPago(xml.replace('TipoDeComprobante="P"', 'TipoDeComprobante="I"'), UUID),
  'INVALID_PAYMENT_XML'
);
assertCfdiError(
  () => validarXmlComplementoPago(xml.replace('Version="2.0"', 'Version="1.0"'), UUID),
  'INVALID_PAYMENT_XML'
);

console.log('CFDI email: pruebas simuladas completadas; no se abrió transporte SMTP.');
