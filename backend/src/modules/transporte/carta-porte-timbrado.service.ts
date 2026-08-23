import { XMLParser } from 'fast-xml-parser';
import type { PoolClient } from 'pg';
import { CfdiService, CfdiValidationError } from '../cfdi/cfdi.service';
import type { CfdiTimbradoHooks, CfdiTimbradoOptions } from '../cfdi/cfdi.types';
import { FACTURAMA_NAME_ID_CARTA_PORTE_31, type CartaPorte31 } from './carta-porte.types';
import { findCartaPorteStampContext, inTransaction, linkPrincipalDocument } from './transporte.repository';
import { TransporteError } from './transporte.types';

export type CartaPorteStampPlan = {
  viajeId: number;
  cartaPorteId: number;
  idCcp: string;
  snapshot: CartaPorte31;
  options: CfdiTimbradoOptions;
};

export function buildCartaPorteStampPlan(row: any, documentoId: number): CartaPorteStampPlan | null {
  if (!row) return null;
  if (!row.carta_porte_id) throw new CfdiValidationError('La factura está vinculada a un viaje sin Carta Porte validada.');
  if (Number(row.documento_id) !== documentoId) throw new CfdiValidationError('La Carta Porte no corresponde a esta factura.');
  if (row.viaje_estatus !== 'validado') throw new CfdiValidationError('El viaje debe estar validado antes de timbrar.');
  if (row.carta_porte_estatus !== 'validado') throw new CfdiValidationError('La Carta Porte debe estar validada antes de timbrar.');
  if (!row.snapshot_json || typeof row.snapshot_json !== 'object') throw new CfdiValidationError('La Carta Porte no contiene snapshot fiscal.');
  const idCcp = String(row.id_ccp ?? '').trim();
  if (!idCcp) throw new CfdiValidationError('La Carta Porte no contiene IdCCP.');
  if (String(row.snapshot_json.IdCCP ?? '') !== idCcp) throw new CfdiValidationError('El IdCCP no coincide con el snapshot fiscal.');
  return {
    viajeId: Number(row.viaje_id), cartaPorteId: Number(row.carta_porte_id), idCcp,
    snapshot: row.snapshot_json,
    options: { nameId: FACTURAMA_NAME_ID_CARTA_PORTE_31, complemento: { CartaPorte31: row.snapshot_json } },
  };
}

export function validateStampedCartaPorteXml(xml: string, expectedIdCcp: string): void {
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', removeNSPrefix: true }).parse(xml);
  const comprobante = parsed?.Comprobante ?? parsed?.['cfdi:Comprobante'];
  const carta = comprobante?.Complemento?.CartaPorte ?? comprobante?.['cfdi:Complemento']?.['cartaporte31:CartaPorte'];
  if (!carta) throw new CfdiValidationError('El XML timbrado no contiene Carta Porte.');
  if (String(carta.Version ?? '') !== '3.1') throw new CfdiValidationError('El XML timbrado no contiene Carta Porte versión 3.1.');
  if (String(carta.IdCCP ?? '') !== expectedIdCcp) throw new CfdiValidationError('El IdCCP del XML timbrado no coincide con la materialización validada.');
}

export function buildCartaPorteStampHooks(plan: CartaPorteStampPlan): CfdiTimbradoHooks {
  return {
    validateStampedXml: (xml) => validateStampedCartaPorteXml(xml, plan.idCcp),
    persistWithinTransaction: async (client: PoolClient) => {
      const carta = await client.query(
        `UPDATE transporte.cartas_porte SET estatus='timbrado', timbrado_at=now(), updated_at=now()
          WHERE id=$1 AND viaje_id=$2 AND estatus='validado' AND id_ccp=$3
          RETURNING id`,
        [plan.cartaPorteId, plan.viajeId, plan.idCcp]
      );
      if (!carta.rowCount) throw new CfdiValidationError('La Carta Porte cambió durante el timbrado; requiere reconciliación.');
      const viaje = await client.query(
        `UPDATE transporte.viajes SET estatus='timbrado', updated_at=now()
          WHERE id=$1 AND estatus='validado' RETURNING id`,
        [plan.viajeId]
      );
      if (!viaje.rowCount) throw new CfdiValidationError('El viaje cambió durante el timbrado; requiere reconciliación.');
    },
  };
}

type CfdiFacturaStamper = Pick<CfdiService, 'timbrarFactura'>;

export function executeCartaPorteStampPlan(
  documentoId: number,
  empresaId: number,
  plan: CartaPorteStampPlan | null,
  cfdi: CfdiFacturaStamper
) {
  return plan
    ? cfdi.timbrarFactura(documentoId, empresaId, plan.options, buildCartaPorteStampHooks(plan))
    : cfdi.timbrarFactura(documentoId, empresaId);
}

export async function timbrarFacturaConTransporte(documentoId: number, empresaId: number, cfdi = new CfdiService()) {
  const row = await findCartaPorteStampContext(documentoId, empresaId);
  const plan = buildCartaPorteStampPlan(row, documentoId);
  return executeCartaPorteStampPlan(documentoId, empresaId, plan, cfdi);
}

export async function vincularFacturaViaje(viajeId: number, documentoId: number, empresaId: number) {
  return inTransaction(async (client) => {
    const relation = await linkPrincipalDocument(client, empresaId, viajeId, documentoId);
    if (!relation) throw new TransporteError('Viaje no encontrado.', 404, 'TRANSPORTE_NOT_FOUND');
    return relation;
  });
}
