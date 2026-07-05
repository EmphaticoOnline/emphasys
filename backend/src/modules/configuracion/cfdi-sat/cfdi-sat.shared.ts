import type { Request } from 'express';
import { resolverContextoScopeComercial } from '../../auth/scope-comercial';
import { decryptSecret } from '../../../utils/secret-crypto';
import { obtenerCredencialesPorEmpresa } from './cfdi-sat-credenciales.repository';
import { obtenerAutorizacionVigente } from './cfdi-sat-autorizacion.repository';
import { CFDI_SAT_AUTORIZACION_VERSION } from './cfdi-sat-autorizacion-texto';

export class CfdiSatPermisoError extends Error {
  status = 403;

  constructor(message = 'Solo un administrador de la empresa puede realizar esta acción') {
    super(message);
    this.name = 'CfdiSatPermisoError';
  }
}

export class CfdiSatValidacionError extends Error {
  status: number;
  /** Código machine-readable opcional (ej. 'PROVEEDOR_NO_ENCONTRADO') para que el
   *  frontend ofrezca una acción específica sin tener que parsear el mensaje. */
  code?: string;

  constructor(message: string, status = 422, code?: string) {
    super(message);
    this.name = 'CfdiSatValidacionError';
    this.status = status;
    this.code = code;
  }
}

export function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

export function getUserId(req: Request): number {
  return Number(req.auth?.userId ?? 0);
}

/**
 * La FIEL solo debe poder cargarse, reemplazarse, eliminarse o autorizarse por un
 * administrador de la empresa (o superadmin). Replica el patrón de
 * documentos-cancel.service.ts en vez de introducir un middleware de roles nuevo.
 */
export async function assertEsAdministrador(req: Request): Promise<void> {
  const empresaId = getEmpresaId(req);
  const contexto = await resolverContextoScopeComercial(empresaId, req.auth?.userId, req.auth?.esSuperadmin);

  if (!contexto.esAdmin) {
    throw new CfdiSatPermisoError();
  }
}

/**
 * Valida credenciales + vigencia de la FIEL + autorización vigente, y devuelve
 * los certificados ya descifrados listos para usarse en memoria. Centraliza la
 * validación que deben repetir crear/verificar/descargar solicitudes.
 */
export async function obtenerCredencialesFielListas(
  empresaId: number
): Promise<{ cerBuffer: Buffer; keyBuffer: Buffer }> {
  const credenciales = await obtenerCredencialesPorEmpresa(empresaId);
  if (!credenciales) {
    throw new CfdiSatValidacionError('No hay credenciales SAT (e.firma) cargadas para esta empresa');
  }

  if (new Date(credenciales.vigencia_hasta).getTime() <= Date.now()) {
    throw new CfdiSatValidacionError('La e.firma (FIEL) cargada está vencida');
  }

  const autorizacion = await obtenerAutorizacionVigente(empresaId, CFDI_SAT_AUTORIZACION_VERSION);
  if (!autorizacion) {
    throw new CfdiSatValidacionError('Falta aceptar la autorización de uso de la e.firma');
  }

  return {
    cerBuffer: Buffer.from(decryptSecret(credenciales.cer_content_encrypted), 'base64'),
    keyBuffer: Buffer.from(decryptSecret(credenciales.key_content_encrypted), 'base64'),
  };
}
