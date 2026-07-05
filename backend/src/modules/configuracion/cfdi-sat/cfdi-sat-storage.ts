import fs from 'fs/promises';
import path from 'path';

/**
 * Storage privado para ZIPs y XMLs descargados del SAT. Deliberadamente NO usa
 * resolveUploadsDir() de uploads.multer.ts: ese directorio se sirve públicamente
 * en app.ts (`app.use("/uploads", express.static(...))`) y este contenido fiscal
 * nunca debe quedar alcanzable por una ruta estática.
 */
export function resolveCfdiSatStorageDir(): string {
  return process.env.CFDI_SAT_STORAGE_DIR
    ? path.resolve(process.env.CFDI_SAT_STORAGE_DIR)
    : path.resolve(process.cwd(), 'private-storage', 'cfdi-sat');
}

function sanitizeSegment(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned || 'na';
}

/**
 * Traduce errores de filesystem crudos (ENOENT/EACCES/ENOTDIR/ENOSPC) a un
 * mensaje que apunta a la causa probable (configuración de CFDI_SAT_STORAGE_DIR)
 * en vez de dejar pasar un error de Node genérico hasta el usuario final.
 *
 * El mensaje devuelto (que termina en mensaje_error de solicitudes/paquetes y
 * es visible para cualquier usuario de la empresa) NUNCA debe incluir la ruta
 * física absoluta del servidor — eso es un detalle de infraestructura, no de
 * negocio. La ruta completa solo se registra en el log del servidor.
 */
function traducirErrorStorage(error: unknown, baseDir: string): Error {
  const code = (error as NodeJS.ErrnoException)?.code;
  const origen = process.env.CFDI_SAT_STORAGE_DIR ? 'la carpeta configurada en CFDI_SAT_STORAGE_DIR' : 'la carpeta de storage por defecto';

  let mensaje: string | null = null;
  if (code === 'EACCES' || code === 'EPERM') {
    mensaje = `No hay permisos de escritura en ${origen}. Contacta al equipo técnico para revisar los permisos del servidor.`;
  } else if (code === 'ENOTDIR') {
    mensaje = `${origen} no es un directorio válido (existe un archivo con ese nombre). Contacta al equipo técnico.`;
  } else if (code === 'ENOSPC') {
    mensaje = `No hay espacio en disco disponible en ${origen}. Contacta al equipo técnico.`;
  } else if (code === 'ENOENT') {
    mensaje = `No se pudo crear/acceder a ${origen}. Contacta al equipo técnico para verificar la configuración.`;
  }

  if (mensaje) {
    console.error(`[CFDI SAT] Error de storage (${code}) en ruta física: ${baseDir}`, error);
    return new Error(mensaje);
  }

  return error instanceof Error ? error : new Error(String(error));
}

async function guardarArchivoPrivado(relativeDir: string, filename: string, contents: Buffer): Promise<string> {
  const baseDir = resolveCfdiSatStorageDir();
  const absoluteDir = path.join(baseDir, relativeDir);

  try {
    await fs.mkdir(absoluteDir, { recursive: true });

    const relativePath = path.join(relativeDir, filename);
    const absolutePath = path.join(baseDir, relativePath);
    await fs.writeFile(absolutePath, contents);

    return relativePath;
  } catch (error) {
    throw traducirErrorStorage(error, baseDir);
  }
}

export async function guardarZipPrivado(params: {
  empresaIdentificador: string;
  solicitudId: number;
  packageId: string;
  contents: Buffer;
}): Promise<string> {
  const relativeDir = path.join('paquetes', sanitizeSegment(params.empresaIdentificador), String(params.solicitudId));
  const filename = `${sanitizeSegment(params.packageId)}.zip`;
  return guardarArchivoPrivado(relativeDir, filename, params.contents);
}

export async function guardarXmlPrivado(params: {
  empresaIdentificador: string;
  uuid: string;
  contents: string;
}): Promise<string> {
  const relativeDir = path.join('xml', sanitizeSegment(params.empresaIdentificador));
  const filename = `${sanitizeSegment(params.uuid)}.xml`;
  return guardarArchivoPrivado(relativeDir, filename, Buffer.from(params.contents, 'utf8'));
}

/**
 * Lee un archivo del storage privado a partir de una ruta relativa ya validada
 * (proviene de nuestra propia base de datos, nunca directamente de la request).
 * Se valida igualmente que el resultado no escape del directorio base.
 */
export async function leerArchivoPrivado(relativePath: string): Promise<Buffer> {
  const baseDir = path.resolve(resolveCfdiSatStorageDir());
  const absolutePath = path.resolve(baseDir, relativePath);

  if (absolutePath !== baseDir && !absolutePath.startsWith(baseDir + path.sep)) {
    throw new Error('Ruta de archivo inválida');
  }

  try {
    return await fs.readFile(absolutePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') {
      throw new Error('El archivo ya no está disponible en el storage privado (¿fue movido o eliminado manualmente?)');
    }
    throw traducirErrorStorage(error, baseDir);
  }
}

export interface UsoAlmacenamientoCarpeta {
  archivos: number;
  bytes: number;
  disponible: boolean;
}

async function medirCarpeta(absoluteDir: string): Promise<UsoAlmacenamientoCarpeta> {
  let archivos = 0;
  let bytes = 0;

  async function recorrer(dir: string): Promise<void> {
    const entradas = await fs.readdir(dir, { withFileTypes: true });
    for (const entrada of entradas) {
      const rutaCompleta = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        await recorrer(rutaCompleta);
      } else if (entrada.isFile()) {
        archivos += 1;
        const stat = await fs.stat(rutaCompleta);
        bytes += stat.size;
      }
    }
  }

  try {
    await recorrer(absoluteDir);
    return { archivos, bytes, disponible: true };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') {
      // Carpeta aún no creada (la empresa nunca ha descargado nada de este tipo): no es un error.
      return { archivos: 0, bytes: 0, disponible: true };
    }
    // Cualquier otro error (permisos, etc.) se reporta como "no disponible" sin tumbar el resumen completo.
    return { archivos: 0, bytes: 0, disponible: false };
  }
}

/**
 * Mide, solo para la carpeta de ESTA empresa (nunca todo CFDI_SAT_STORAGE_DIR),
 * cuántos archivos y bytes ocupan los ZIP de paquetes y los XML extraídos.
 * Es un recorrido acotado al espacio de la empresa, no un escaneo global.
 */
export async function medirUsoAlmacenamientoEmpresa(empresaIdentificador: string): Promise<{
  zips: UsoAlmacenamientoCarpeta;
  xmls: UsoAlmacenamientoCarpeta;
}> {
  const baseDir = resolveCfdiSatStorageDir();
  const segmento = sanitizeSegment(empresaIdentificador);

  const [zips, xmls] = await Promise.all([
    medirCarpeta(path.join(baseDir, 'paquetes', segmento)),
    medirCarpeta(path.join(baseDir, 'xml', segmento)),
  ]);

  return { zips, xmls };
}
