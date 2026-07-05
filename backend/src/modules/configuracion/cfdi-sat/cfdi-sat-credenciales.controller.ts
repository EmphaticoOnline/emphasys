import type { Request, Response } from 'express';
import { encryptSecret } from '../../../utils/secret-crypto';
import { normalizeRFC } from '../../../shared/normalizers/rfc';
import { obtenerEmpresaPorId } from '../../../services/empresasService';
import { assertKeyBufferEsValido, parseCerBuffer } from './cfdi-sat-cert-parser';
import {
  eliminarCredenciales,
  guardarCredenciales,
  obtenerCredencialesPorEmpresa,
  type CfdiSatCredencialRow,
} from './cfdi-sat-credenciales.repository';
import { registrarBitacora } from './cfdi-sat-bitacora.repository';
import { assertEsAdministrador, CfdiSatPermisoError, getEmpresaId, getUserId } from './cfdi-sat.shared';

function getSingleFile(files: Request['files'], fieldName: string): Express.Multer.File | null {
  if (!files || Array.isArray(files)) return null;
  const list = files[fieldName];
  return Array.isArray(list) && list.length > 0 ? list[0] ?? null : null;
}

function hasExtension(file: Express.Multer.File, extension: string): boolean {
  return (file.originalname || '').toLowerCase().endsWith(extension);
}

function toPublicCredenciales(row: CfdiSatCredencialRow | null) {
  if (!row) {
    return { existe: false as const };
  }

  return {
    existe: true as const,
    rfc_certificado: row.rfc_certificado,
    vigencia_desde: row.vigencia_desde,
    vigencia_hasta: row.vigencia_hasta,
    cargado_en: row.cargado_en,
    vigente: new Date(row.vigencia_hasta).getTime() > Date.now(),
  };
}

export async function obtenerCredencialesController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const row = await obtenerCredencialesPorEmpresa(empresaId);
    return res.json(toPublicCredenciales(row));
  } catch (error) {
    console.error('[CFDI SAT] Error al obtener credenciales', error);
    return res.status(500).json({ message: 'No se pudieron obtener las credenciales SAT' });
  }
}

export async function subirCredencialesController(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  const usuarioId = getUserId(req);

  try {
    await assertEsAdministrador(req);

    const cerFile = getSingleFile(req.files, 'cer');
    const keyFile = getSingleFile(req.files, 'key');

    if (!cerFile) {
      return res.status(400).json({ message: 'Se requiere el archivo .cer (campo cer)' });
    }
    if (!keyFile) {
      return res.status(400).json({ message: 'Se requiere el archivo .key (campo key)' });
    }
    if (!hasExtension(cerFile, '.cer')) {
      return res.status(400).json({ message: 'El archivo cer debe tener extensión .cer' });
    }
    if (!hasExtension(keyFile, '.key')) {
      return res.status(400).json({ message: 'El archivo key debe tener extensión .key' });
    }

    const empresa = await obtenerEmpresaPorId(empresaId);
    if (!empresa) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    let certInfo;
    try {
      certInfo = parseCerBuffer(cerFile.buffer);
    } catch {
      return res.status(400).json({ message: 'El archivo .cer no es un certificado válido' });
    }

    try {
      assertKeyBufferEsValido(keyFile.buffer);
    } catch {
      return res.status(400).json({ message: 'El archivo .key no tiene un formato válido' });
    }

    const rfcCertificado = normalizeRFC(certInfo.rfc);
    const rfcEmpresa = normalizeRFC(empresa.rfc);

    if (!rfcCertificado) {
      return res.status(422).json({ message: 'No fue posible extraer el RFC del certificado .cer' });
    }

    if (rfcCertificado !== rfcEmpresa) {
      return res.status(422).json({
        message: `El RFC del certificado (${rfcCertificado}) no coincide con el RFC de la empresa (${rfcEmpresa ?? 'sin RFC'})`,
      });
    }

    const cerContentEncrypted = encryptSecret(cerFile.buffer.toString('base64'));
    const keyContentEncrypted = encryptSecret(keyFile.buffer.toString('base64'));

    const saved = await guardarCredenciales({
      empresaId,
      rfcCertificado,
      cerContentEncrypted,
      keyContentEncrypted,
      vigenciaDesde: certInfo.vigenciaDesde,
      vigenciaHasta: certInfo.vigenciaHasta,
      cargadoPor: usuarioId,
    });

    await registrarBitacora({
      empresaId,
      usuarioId,
      accion: 'credencial_subida',
      detalle: `RFC ${rfcCertificado}, vigente hasta ${certInfo.vigenciaHasta.toISOString()}`,
    });

    return res.status(201).json(toPublicCredenciales(saved));
  } catch (error: any) {
    if (error instanceof CfdiSatPermisoError) {
      return res.status(403).json({ message: error.message });
    }

    console.error('[CFDI SAT] Error al subir credenciales', error);

    await registrarBitacora({
      empresaId,
      usuarioId,
      accion: 'credencial_subida',
      resultado: 'error',
      detalle: String(error?.message ?? 'Error desconocido').slice(0, 500),
    }).catch(() => {});

    return res.status(500).json({ message: 'No se pudieron guardar las credenciales SAT' });
  }
}

export async function eliminarCredencialesController(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  const usuarioId = getUserId(req);

  try {
    await assertEsAdministrador(req);

    const eliminado = await eliminarCredenciales(empresaId);
    if (!eliminado) {
      return res.status(404).json({ message: 'No hay credenciales SAT registradas para esta empresa' });
    }

    await registrarBitacora({ empresaId, usuarioId, accion: 'credencial_eliminada' });

    return res.status(204).send();
  } catch (error: any) {
    if (error instanceof CfdiSatPermisoError) {
      return res.status(403).json({ message: error.message });
    }

    console.error('[CFDI SAT] Error al eliminar credenciales', error);
    return res.status(500).json({ message: 'No se pudieron eliminar las credenciales SAT' });
  }
}
