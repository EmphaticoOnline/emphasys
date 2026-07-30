import assert from 'node:assert/strict';
import {
  assertPagoComplementPayload,
  buildPagoComplementPayload,
  type PagoComplementData,
} from '../modules/cfdi/pago-complement.builder';

function fixture(folio: string | number | null = 3): PagoComplementData {
  return {
    empresa: {
      rfc: 'AAA010101AAA',
      razon_social: 'EMISOR DE PRUEBA',
      regimen_fiscal: '601',
      codigo_postal_id: '06000',
    },
    receptor: {
      rfc: 'BBB010101BBB',
      nombre: 'RECEPTOR DE PRUEBA',
      regimen_fiscal: '601',
      codigo_postal: '64000',
    },
    pago: {
      serie: 'PCL',
      folio,
      monto: 18600,
      forma_pago: '03',
      moneda: 'MXN',
      tipo_cambio: 1,
      fecha: '2026-06-10T12:00:00.000Z',
    },
    aplicaciones: [
      {
        uuid_factura: '00000000-0000-0000-0000-000000000018',
        serie: 'B',
        folio: '18',
        moneda_factura: 'MXN',
        tipo_cambio_factura: 1,
        total_factura: 18600,
        monto_moneda_documento: 18600,
        num_parcialidad: 1,
        imp_saldo_ant: 18600,
        imp_saldo_insoluto: 0,
        payment_method: 'PPD',
        impuestos: [],
      },
    ],
  };
}

const payload = buildPagoComplementPayload(fixture());
assert.equal(payload.Serie, 'PCL');
assert.equal(payload.Folio, '3');
assert.equal(payload.CfdiType, 'P');
assert.equal(payload.Complemento.Payments.length, 1);
assert.equal(payload.Complemento.Payments[0].RelatedDocuments.length, 1);
assert.equal(payload.Complemento.Payments[0].RelatedDocuments[0].Serie, 'B');
assert.equal(payload.Complemento.Payments[0].RelatedDocuments[0].Folio, '18');
assert.equal(
  payload.Complemento.Payments[0].RelatedDocuments[0].Uuid,
  '00000000-0000-0000-0000-000000000018'
);
assert.equal(payload.Complemento.Payments[0].RelatedDocuments[0].PaymentMethod, 'PPD');
assert.notEqual(payload.Folio, payload.Complemento.Payments[0].RelatedDocuments[0].Folio);

for (const invalidFolio of [null, '', '   ', 'X'.repeat(41)]) {
  assert.throws(
    () => buildPagoComplementPayload(fixture(invalidFolio)),
    /no tiene un folio válido/
  );
}

const incomplete = structuredClone(payload) as any;
incomplete.Complemento.Payments[0].RelatedDocuments = [];
assert.throws(
  () => assertPagoComplementPayload(incomplete),
  /datos fiscales incompletos/
);

console.log('Pruebas locales de complemento de pago: OK (sin cliente HTTP).');
