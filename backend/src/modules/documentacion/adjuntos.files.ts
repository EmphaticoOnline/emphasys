import fs from 'fs/promises';
import path from 'path';
import pool from '../../config/database';

export function adjuntosStorageRoot() {
  return path.resolve(process.env.DOCUMENTACION_STORAGE_DIR || path.join(process.cwd(), 'private-storage', 'documentacion', 'adjuntos'));
}

export function adjuntoPhysicalPath(relativePath: string) {
  const root = adjuntosStorageRoot();
  const file = path.resolve(root, relativePath);
  if (!file.startsWith(`${root}${path.sep}`)) throw new Error('Ruta física de adjunto inválida');
  return file;
}

export type AdjuntoFile = {
  adjuntoId: number;
  documentoId: number | null;
  empresaId: number;
  archivoUrl: string;
};

export async function eliminarArchivosAdjuntos(files: AdjuntoFile[]) {
  let failures = 0;
  for (const file of files) {
    try { await fs.unlink(adjuntoPhysicalPath(file.archivoUrl)); }
    catch (error: any) {
      if (error?.code === 'ENOENT') continue;
      failures++;
      const message = error instanceof Error ? error.message : String(error);
      try {
        await pool.query(
          `INSERT INTO public.audit_log(empresa_id,modulo,entidad,entidad_id,accion,descripcion,datos_nuevos,origen,created_at)
           VALUES($1,'documentacion','adjuntos',$2,'limpieza_fisica_pendiente',$3,$4,'sistema',now())`,
          [file.empresaId, file.adjuntoId, `No se pudo eliminar el archivo físico del adjunto ${file.adjuntoId}`, { adjunto_id: file.adjuntoId, documento_id: file.documentoId, ruta: file.archivoUrl, error: message, fecha_fallo: new Date().toISOString() }]
        );
      } catch (auditError) {
        console.error('[ADJUNTOS] No se pudo persistir el fallo de limpieza física', { file, error: message, auditError });
      }
      console.error('[ADJUNTOS] Limpieza física pendiente', { ...file, error: message });
    }
  }
  return failures;
}
