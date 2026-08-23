import assert from 'node:assert/strict';
import { convertXmlCfdiToFacturamaJson } from '../modules/cfdi/convertXmlCfdiToFacturamaJson';
import {
  buildCartaPorteStampPlan,
  executeCartaPorteStampPlan,
  validateStampedCartaPorteXml,
} from '../modules/transporte/carta-porte-timbrado.service';
import { markTransportCancelledForDocument, type DbClient } from '../modules/transporte/transporte.repository';

const snapshot = { Version: '3.1', IdCCP: 'CCC3EB8D-81CD-4557-8719-26632D2FA434' } as any;
const validRow = {
  viaje_id: 7, viaje_estatus: 'validado', carta_porte_id: 8,
  documento_id: 9, carta_porte_estatus: 'validado', id_ccp: snapshot.IdCCP,
  snapshot_json: snapshot,
};
const cfdiXml = `<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" LugarExpedicion="45000" TipoDeComprobante="I"><cfdi:Emisor Rfc="AAA010101AAA" Nombre="Emisor" RegimenFiscal="601"/><cfdi:Receptor Rfc="BBB010101BBB"/><cfdi:Conceptos><cfdi:Concepto ClaveProdServ="1" Descripcion="X" ClaveUnidad="H87" Cantidad="1" ValorUnitario="1" ObjetoImp="01"/></cfdi:Conceptos></cfdi:Comprobante>`;
const stampedXml = `<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:cartaporte31="http://www.sat.gob.mx/CartaPorte31"><cfdi:Complemento><cartaporte31:CartaPorte Version="3.1" IdCCP="${snapshot.IdCCP}"/></cfdi:Complemento></cfdi:Comprobante>`;

async function main() {
  // A: ordinaria conserva defaults y se ejecuta sin opciones/hook.
  const ordinary = convertXmlCfdiToFacturamaJson(cfdiXml);
  assert.equal(ordinary.NameId, '1');
  assert.equal(Object.prototype.hasOwnProperty.call(ordinary, 'Complemento'), false);
  let ordinaryArgs: unknown[] = [];
  await executeCartaPorteStampPlan(9, 1, null, { async timbrarFactura(...args: unknown[]) { ordinaryArgs = args; return {} as any; } } as any);
  assert.equal(ordinaryArgs.length, 2);

  // B: viaje sin materialización validada se rechaza.
  assert.throws(() => buildCartaPorteStampPlan({ viaje_id: 7, viaje_estatus: 'validado' }, 9), /sin Carta Porte validada/i);

  // C: snapshot exacto y NameId 36.
  const plan = buildCartaPorteStampPlan(validRow, 9)!;
  assert.equal(plan.options.nameId, '36');
  assert.strictEqual((plan.options.complemento as any).CartaPorte31, snapshot);

  // D: fallo PAC no ejecuta persistencia Transporte.
  let persisted = false;
  await assert.rejects(
    () => executeCartaPorteStampPlan(9, 1, plan, { async timbrarFactura() { throw new Error('PAC caído'); } } as any),
    /PAC caído/
  );
  assert.equal(persisted, false);

  // E: XML correcto y hook atómico marcan Carta/Viaje.
  const state = { carta: 'validado', viaje: 'validado' };
  const fakeClient = {
    async query(sql: string) {
      if (sql.includes('UPDATE transporte.cartas_porte')) { state.carta = 'timbrado'; persisted = true; return { rowCount: 1, rows: [{ id: 8 }] }; }
      if (sql.includes('UPDATE transporte.viajes')) { state.viaje = 'timbrado'; return { rowCount: 1, rows: [{ id: 7 }] }; }
      throw new Error(`SQL inesperado: ${sql}`);
    },
  } as unknown as DbClient;
  await executeCartaPorteStampPlan(9, 1, plan, {
    async timbrarFactura(_d: number, _e: number, _o: unknown, hooks: any) {
      hooks.validateStampedXml(stampedXml);
      await hooks.persistWithinTransaction(fakeClient);
      return {} as any;
    },
  } as any);
  assert.deepEqual(state, { carta: 'timbrado', viaje: 'timbrado' });

  // F: complemento ausente o IdCCP distinto.
  assert.throws(() => validateStampedCartaPorteXml('<Comprobante><Complemento/></Comprobante>', snapshot.IdCCP), /no contiene Carta Porte/i);
  assert.throws(() => validateStampedCartaPorteXml(stampedXml.replace(snapshot.IdCCP, 'CCC00000-0000-4000-8000-000000000000'), snapshot.IdCCP), /no coincide/i);

  // G: cancelación confirmada usa actualización conjunta de Transporte.
  let cancellationSql = '';
  await markTransportCancelledForDocument({ async query(sql: string) { cancellationSql = sql; return { rows: [], rowCount: 1 } as any; } } as DbClient, 9, 1);
  assert.match(cancellationSql, /cartas_porte[\s\S]*estatus='cancelado'[\s\S]*viajes[\s\S]*estatus='cancelado'/);
  console.log('Integración Carta Porte/CFDI: casos A-G OK, sin Facturama real.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
