import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import pool from '../../config/database';

// Producción debe definir las raíces explícitamente para que sean persistentes
// y queden fuera de current/releases. El fallback sólo sirve para desarrollo
// local y tampoco depende del directorio desde el que se inicia Node.
function localPrivateStoragePath(...segments: string[]) {
  return path.join(os.homedir(), '.emphasys', 'private-storage', ...segments);
}

export function adjuntosStorageRoot() {
  return path.resolve(process.env.DOCUMENTACION_STORAGE_DIR || localPrivateStoragePath('documentacion', 'adjuntos'));
}

export function adjuntoLegacyContactosPath(relativePath: string) {
  const root = path.resolve(process.env.DOCUMENTACION_CONTACTOS_STORAGE_DIR || localPrivateStoragePath('documentacion', 'contactos'));
  const file = path.resolve(root, relativePath);
  if (!file.startsWith(`${root}${path.sep}`)) throw new Error('Ruta física legacy inválida');
  return file;
}

export function resolverAdjuntoPath(storageKey: string) {
  if (storageKey.startsWith('contactos/')) return adjuntoLegacyContactosPath(storageKey.slice('contactos/'.length));
  return adjuntoPhysicalPath(storageKey);
}

export function adjuntoPhysicalPath(relativePath: string) {
  const root = adjuntosStorageRoot();
  const file = path.resolve(root, relativePath);
  if (!file.startsWith(`${root}${path.sep}`)) throw new Error('Ruta física de adjunto inválida');
  return file;
}

export type AdjuntoFile = {
  adjuntoId: number;
  documentoId?: number | null;
  empresaId: number;
  storageKey: string;
};

export async function eliminarArchivosAdjuntos(files: AdjuntoFile[]) {
  let failures = 0;
  for (const file of files) {
    try { await fs.unlink(resolverAdjuntoPath(file.storageKey)); }
    catch (error: any) {
      if (error?.code === 'ENOENT') continue;
      failures++;
      const message = error instanceof Error ? error.message : String(error);
      try {
        await pool.query(
          `INSERT INTO public.audit_log(empresa_id,modulo,entidad,entidad_id,accion,descripcion,datos_nuevos,origen,created_at)
           VALUES($1,'documentacion','adjuntos',$2,'limpieza_fisica_pendiente',$3,$4,'sistema',now())`,
          [file.empresaId, file.adjuntoId, `No se pudo eliminar el archivo físico del adjunto ${file.adjuntoId}`, { adjunto_id: file.adjuntoId, documento_id: file.documentoId ?? null, ruta: file.storageKey, error: message, fecha_fallo: new Date().toISOString() }]
        );
      } catch (auditError) {
        console.error('[ADJUNTOS] No se pudo persistir el fallo de limpieza física', { file, error: message, auditError });
      }
      console.error('[ADJUNTOS] Limpieza física pendiente', { ...file, error: message });
    }
  }
  return failures;
}
