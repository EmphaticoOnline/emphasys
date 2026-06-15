import fs from 'fs/promises';
import path from 'path';
import type { Request, Response } from 'express';
import pool from '../../config/database';
import { obtenerEmpresaActivaDeUsuario } from '../auth/auth.service';
import { obtenerEmpresaActivaPorId } from '../auth/auth.middleware';
import { FacturamaClient } from './facturama.client';
import { encryptSecret } from '../../utils/secret-crypto';
import { obtenerEmpresaPorId } from '../../services/empresasService';
import { saveEmpresaFile } from '../../services/fileStorage.service';

function parseEmpresaId(raw: unknown): number | null {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPdfCertFile(file: Express.Multer.File, extension: '.cer' | '.key'): boolean {
  const fileExt = path.extname(file.originalname || '').toLowerCase();
  return fileExt === extension;
}

function getSingleFile(files: Request['files'], fieldName: string): Express.Multer.File | null {
  if (!files) return null;
  if (Array.isArray(files)) return null;

  const list = files[fieldName];
  if (!Array.isArray(list) || list.length === 0) return null;

  return list[0] ?? null;
}

async function hasEmpresaAccess(req: Request, empresaId: number): Promise<boolean> {
  if (!req.auth) return false;

  if (req.auth.esSuperadmin) {
    const empresa = await obtenerEmpresaActivaPorId(empresaId);
    return Boolean(empresa);
  }

  const empresa = await obtenerEmpresaActivaDeUsuario(req.auth.userId, empresaId);
  return Boolean(empresa);
}

function sanitizeCsdPayloadLog(payload: {
  Rfc: string;
  Certificate: string;
  PrivateKey: string;
  PrivateKeyPassword: string;
}) {
  return {
    Rfc: payload.Rfc,
    Certificate: `[base64:${payload.Certificate.length}]`,
    PrivateKey: `[base64:${payload.PrivateKey.length}]`,
    PrivateKeyPassword: '***',
  };
}

export async function registrarCsdEmpresaFacturamaController(req: Request, res: Response) {
  try {
    const empresaId = parseEmpresaId(req.params.empresaId);
    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId inválido' });
    }

    if (!req.auth) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const canAccess = await hasEmpresaAccess(req, empresaId);
    if (!canAccess) {
      return res.status(403).json({ message: 'No tienes acceso a la empresa indicada' });
    }

    const empresa = await obtenerEmpresaPorId(empresaId);
    if (!empresa || !empresa.activo) {
      return res.status(404).json({ message: 'Empresa no encontrada o inactiva' });
    }

    const cerFile = getSingleFile(req.files, 'cer') ?? getSingleFile(req.files, 'archivo_cer');
    const keyFile = getSingleFile(req.files, 'key') ?? getSingleFile(req.files, 'archivo_key');
    const password = String(req.body?.password ?? req.body?.privateKeyPassword ?? '').trim();

    if (!cerFile) {
      return res.status(400).json({ message: 'Se requiere archivo .cer (campo cer)' });
    }

    if (!keyFile) {
      return res.status(400).json({ message: 'Se requiere archivo .key (campo key)' });
    }

    if (!password) {
      return res.status(400).json({ message: 'Se requiere la contraseña del CSD' });
    }

    if (!isPdfCertFile(cerFile, '.cer')) {
      return res.status(400).json({ message: 'El archivo cer debe tener extensión .cer' });
    }

    if (!isPdfCertFile(keyFile, '.key')) {
      return res.status(400).json({ message: 'El archivo key debe tener extensión .key' });
    }

    const savedCer = await saveEmpresaFile({
      empresaIdentificador: `${empresa.identificador}_cfdi_csd`,
      file: cerFile,
    });

    const savedKey = await saveEmpresaFile({
      empresaIdentificador: `${empresa.identificador}_cfdi_csd`,
      file: keyFile,
    });

    const encryptedPassword = encryptSecret(password);

    await pool.query(
      `UPDATE core.empresas
          SET cfdi_csd_registrado_facturama = FALSE,
              cfdi_csd_cer_path = $2,
              cfdi_csd_key_path = $3,
              cfdi_csd_password_encrypted = $4
        WHERE id = $1`,
      [empresaId, savedCer.relativePath, savedKey.relativePath, encryptedPassword]
    );

    const cerBuffer = await fs.readFile(savedCer.absolutePath);
    const keyBuffer = await fs.readFile(savedKey.absolutePath);

    const payload = {
      Rfc: empresa.rfc,
      Certificate: cerBuffer.toString('base64'),
      PrivateKey: keyBuffer.toString('base64'),
      PrivateKeyPassword: password,
    };

    const facturama = await FacturamaClient.fromDatabaseOrEnv();

    console.info('[CFDI CSD][Facturama] Request', {
      empresaId,
      empresaIdentificador: empresa.identificador,
      endpoint: facturama.getMultiemisorCsdEndpoint(),
      payload: sanitizeCsdPayloadLog(payload),
    });

    const responseData = await facturama.registerMultiemisorCsd(payload);

    console.info('[CFDI CSD][Facturama] Response', {
      empresaId,
      status: 'success',
      response: responseData,
    });

    await pool.query(
      `UPDATE core.empresas
          SET cfdi_csd_registrado_facturama = TRUE,
              cfdi_csd_fecha_actualizacion = NOW()
        WHERE id = $1`,
      [empresaId]
    );

    return res.json({
      message: 'CSD registrado correctamente',
      cfdi_csd_registrado_facturama: true,
      cfdi_csd_fecha_actualizacion: new Date().toISOString(),
      facturamaResponse: responseData,
    });
  } catch (error: any) {
    console.error('[CFDI CSD][Facturama] Error', {
      empresaId: req.params.empresaId,
      message: error?.message,
      statusCode: error?.statusCode,
      facturamaResponse: error?.facturamaResponse,
      stack: error?.stack,
    });

    const statusCode = Number(error?.statusCode);
    // 401/403 de Facturama no deben reenviarse al cliente — apiFetch los
    // interpreta como sesión vencida y cierra la sesión del usuario.
    const status = Number.isFinite(statusCode) && statusCode !== 401 && statusCode !== 403
      ? Math.min(Math.max(statusCode, 400), 502)
      : 422;
    const message = String(error?.message || 'No se pudo registrar el CSD en Facturama');

    return res.status(status).json({ message });
  }
}
