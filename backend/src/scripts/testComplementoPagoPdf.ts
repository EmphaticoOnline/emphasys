import assert from 'node:assert/strict';
import { parseComplementoPagoXml } from '../modules/cfdi/complemento-pago-xml.parser';
import { generarComplementoPagoPdfDesdeXml } from '../modules/documentos/complemento-pago.pdf';

const related = (index: number, currency = 'MXN') => `
  <pago20:DoctoRelacionado IdDocumento="00000000-0000-0000-0000-${String(index).padStart(12, '0')}"
    Serie="B" Folio="${index}" MonedaDR="${currency}" NumParcialidad="1"
    ImpSaldoAnt="1000.00" ImpPagado="1000.00" ImpSaldoInsoluto="0.00" ObjetoImpDR="02"/>`;

const fixture = (options: { type?: string; relatedCount?: number; currency?: string; banking?: boolean } = {}) => {
  const currency = options.currency || 'MXN';
  const relatedCount = options.relatedCount ?? 2;
  return `<?xml version="1.0"?>
  <cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
    xmlns:pago20="http://www.sat.gob.mx/Pagos20"
    xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
    TipoDeComprobante="${options.type || 'P'}" Serie="PCL" Folio="3"
    Fecha="2026-06-10T12:00:00" LugarExpedicion="44930" NoCertificado="CERT-EMISOR" Sello="SELLOCFDI12345678">
    <cfdi:Emisor Rfc="AAA010101AAA" Nombre="EMISOR DE PRUEBA" RegimenFiscal="601"/>
    <cfdi:Receptor Rfc="BBB010101BBB" Nombre="RECEPTOR DE PRUEBA" RegimenFiscalReceptor="601"
      DomicilioFiscalReceptor="45200" UsoCFDI="CP01"/>
    <cfdi:Complemento>
      <pago20:Pagos Version="2.0">
        <pago20:Totales MontoTotalPagos="${relatedCount * 1000}.00"/>
        <pago20:Pago FechaPago="2026-06-10T10:00:00" FormaDePagoP="03" MonedaP="${currency}"
          Monto="${relatedCount * 1000}.00" ${options.banking ? 'NumOperacion="OP-123" RfcEmisorCtaOrd="AAA010101AAA" CtaOrdenante="0123456789" RfcEmisorCtaBen="BBB010101BBB" CtaBeneficiario="9876543210"' : ''}>
          ${Array.from({ length: relatedCount }, (_, index) => related(index + 1, currency)).join('')}
        </pago20:Pago>
      </pago20:Pagos>
      <tfd:TimbreFiscalDigital UUID="11111111-1111-1111-1111-111111111111"
        FechaTimbrado="2026-06-10T12:01:00" NoCertificadoSAT="CERT-SAT"
        RfcProvCertif="PAC010101AAA" SelloSAT="SELLOSAT"/>
    </cfdi:Complemento>
  </cfdi:Comprobante>`;
};

const parsed = parseComplementoPagoXml(fixture({ banking: true }));
assert.equal(parsed.pagos[0].documentos.length, 2);
assert.equal(parsed.pagos[0].numeroOperacion, 'OP-123');
assert.equal(parsed.pagos[0].documentos[0].moneda, 'MXN');
assert.equal(parseComplementoPagoXml(fixture({ currency: 'USD' })).pagos[0].moneda, 'USD');
assert.throws(() => parseComplementoPagoXml(fixture({ type: 'I' })), /XML fiscal está incompleto/);
assert.throws(
  () => parseComplementoPagoXml(fixture().replace(/<pago20:DoctoRelacionado[^>]+\/>/g, '')),
  /XML fiscal está incompleto/
);

async function main() {
  const multiPagePdf = await generarComplementoPagoPdfDesdeXml(fixture({ relatedCount: 30, banking: true }), {
    estadoSat: 'vigente',
    cadenaOriginal: '||1.1|CADENA-DE-PRUEBA||',
  });
  assert.equal(multiPagePdf.subarray(0, 4).toString(), '%PDF');
  assert.ok(multiPagePdf.length > 5000);
  console.log('Parser y PDF de Pagos 2.0: OK (múltiples documentos, páginas, USD y bancos; sin HTTP).');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
