import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import sharp from 'sharp';
import { resolveUploadsDir } from '../modules/uploads/uploads.multer';

/**
 * Genera y persiste, una sola vez por imagen, una versión optimizada para
 * impresión en PDF (JPEG/PNG reducido) de las imágenes de partida. Toda
 * generación/optimización con Sharp vive exclusivamente aquí — el generador
 * de PDF (documentos.pdf.ts) solo consume `obtenerRutaPdfPreview` y lee el
 * archivo resultante; nunca vuelve a procesar imágenes.
 *
 * El original NUNCA se lee para escribir ni se modifica: esta función solo
 * lee sus bytes para producir un archivo derivado independiente.
 */

// Cambiar esta constante (no dispersar el identificador en otros archivos) es
// la única forma de invalidar todos los derivados existentes: al incrementar
// la versión, la ruta calculada cambia y las imágenes ya optimizadas con la
// configuración anterior simplemente dejan de encontrarse, generándose de
// nuevo con la nueva configuración la próxima vez que se necesiten. No borra
// ni migra los derivados de la versión anterior (quedan huérfanos en su
// carpeta versionada hasta una limpieza manual, fuera del alcance de esto).
export const PDF_PREVIEW_VERSION = 'v1';

const PDF_PREVIEW_DIRNAME = 'pdf-preview';
const PDF_PREVIEW_EXTERNAS_DIRNAME = '_externas';

// Techo físico de impresión, en puntos PDF (1/72"), usado para calcular la
// resolución del derivado. Una imagen de partida vive en una celda de tabla
// de una página de máximo 612pt de ancho (carta); 200pt (~2.78") excede con
// margen cualquier layout configurado hoy (el único activo usa 60pt de alto)
// o razonablemente esperado a futuro. Como PDFKit reescala la imagen al
// tamaño de recuadro indicado en cada documento (no la inserta a resolución
// nativa), un único derivado "techo" sirve para cualquier layout más pequeño
// sin necesidad de variantes por documento/empresa/serie.
const PDF_PREVIEW_ENVELOPE_PT = 200;
// 144 dpi: mismo criterio ya usado en el sistema (rango 130-150 dpi razonable
// para impresión, y exactamente 2x los puntos PDF).
const PDF_PREVIEW_DPI = 144;
const PDF_PREVIEW_MAX_DIMENSION_PX = Math.round(PDF_PREVIEW_ENVELOPE_PT * (PDF_PREVIEW_DPI / 72));
const PDF_PREVIEW_JPEG_QUALITY = 74;
const PDF_PREVIEW_DOWNLOAD_TIMEOUT_MS = 15_000;

type ExtensionDerivado = 'jpg' | 'png';
const EXTENSIONES_DERIVADO: readonly ExtensionDerivado[] = ['jpg', 'png'];

/**
 * Valida estrictamente que `valor` (URL absoluta o ruta) apunte a un archivo
 * dentro de uploads/ y devuelve su ruta absoluta en disco. Rechaza cualquier
 * intento de path traversal o de escapar del directorio autorizado. Devuelve
 * null si `valor` no corresponde a un archivo local de uploads/ (URL externa
 * legítima, valor vacío, o intento de traversal).
 */
function resolverRutaOriginalLocal(valor: string): string | null {
  const raw = valor.trim();
  if (!raw) return null;

  let pathname: string;
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname;
    } catch {
      return null;
    }
  } else {
    pathname = raw;
  }

  const normalizedPathname = pathname.replace(/\\/g, '/');
  const match = normalizedPathname.match(/^\/?uploads\/(.+)$/i);
  if (!match) return null;

  let relativo: string;
  try {
    relativo = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  if (!relativo) return null;

  const uploadsRoot = resolveUploadsDir();
  const absoluto = path.resolve(uploadsRoot, relativo);
  const relacionConRaiz = path.relative(uploadsRoot, absoluto);

  // path.relative devuelve algo que empieza con '..' o una ruta absoluta si
  // `absoluto` quedó fuera de uploadsRoot (traversal vía ../../, etc.).
  if (relacionConRaiz.startsWith('..') || path.isAbsolute(relacionConRaiz)) {
    return null;
  }

  return absoluto;
}

function calcularRutaDerivadaLocal(rutaOriginalAbsoluta: string, extension: ExtensionDerivado): string {
  const uploadsRoot = resolveUploadsDir();
  const relativoOriginal = path.relative(uploadsRoot, rutaOriginalAbsoluta);
  const extensionOriginal = path.extname(relativoOriginal);
  const relativoSinExtension = extensionOriginal
    ? relativoOriginal.slice(0, -extensionOriginal.length)
    : relativoOriginal;
  return path.join(uploadsRoot, PDF_PREVIEW_DIRNAME, PDF_PREVIEW_VERSION, `${relativoSinExtension}.${extension}`);
}

function calcularRutaDerivadaExterna(urlExterna: string, extension: ExtensionDerivado): string {
  const uploadsRoot = resolveUploadsDir();
  const hash = crypto.createHash('sha256').update(urlExterna).digest('hex');
  return path.join(uploadsRoot, PDF_PREVIEW_DIRNAME, PDF_PREVIEW_VERSION, PDF_PREVIEW_EXTERNAS_DIRNAME, `${hash}.${extension}`);
}

async function buscarDerivadoExistente(
  calcularRuta: (extension: ExtensionDerivado) => string
): Promise<string | null> {
  for (const extension of EXTENSIONES_DERIVADO) {
    const candidato = calcularRuta(extension);
    try {
      await fs.access(candidato);
      return candidato;
    } catch {
      // no existe con esta extensión; probar la siguiente
    }
  }
  return null;
}

/**
 * Único lugar del sistema que ejecuta Sharp para impresión. Decide
 * JPEG-vs-PNG según transparencia real (no solo presencia de canal alfa),
 * nunca amplía imágenes pequeñas (`withoutEnlargement`), y aplica la misma
 * calidad ya validada en producción (JPEG q74 + mozjpeg, PNG nivel 9).
 */
async function optimizarImagenParaPdfPreview(buffer: Buffer): Promise<{ buffer: Buffer; extension: ExtensionDerivado }> {
  const metadata = await sharp(buffer, { failOn: 'none' }).metadata();

  let necesitaTransparencia = false;
  if (metadata.hasAlpha) {
    try {
      const stats = await sharp(buffer, { failOn: 'none' }).stats();
      const canalAlfa = stats.channels[stats.channels.length - 1];
      // Si el canal alfa nunca baja de 255, la imagen es 100% opaca y la
      // transparencia declarada por el formato no se usa realmente.
      necesitaTransparencia = !canalAlfa || canalAlfa.min < 255;
    } catch {
      // Si no se puede evaluar el canal alfa, se conserva la transparencia
      // por seguridad en vez de arriesgar un fondo mal compuesto.
      necesitaTransparencia = true;
    }
  }

  let pipeline = sharp(buffer, { failOn: 'none' }).resize({
    width: PDF_PREVIEW_MAX_DIMENSION_PX,
    height: PDF_PREVIEW_MAX_DIMENSION_PX,
    fit: 'inside',
    withoutEnlargement: true,
  });

  if (metadata.hasAlpha && !necesitaTransparencia) {
    pipeline = pipeline.flatten({ background: '#ffffff' });
  }

  if (necesitaTransparencia) {
    const optimizada = await pipeline.png({ compressionLevel: 9 }).toBuffer();
    return { buffer: optimizada, extension: 'png' };
  }

  const optimizada = await pipeline
    .jpeg({ quality: PDF_PREVIEW_JPEG_QUALITY, chromaSubsampling: '4:2:0', mozjpeg: true })
    .toBuffer();
  return { buffer: optimizada, extension: 'jpg' };
}

/**
 * Optimiza `buffer` y lo persiste en la ruta calculada por
 * `calcularRutaDestino(extension)`, con escritura a archivo temporal único +
 * rename atómico (evita que un lector concurrente vea un archivo a medio
 * escribir). Si otra generación concurrente ya escribió el mismo destino, el
 * rename simplemente lo reemplaza con bytes idénticos (la optimización es
 * determinística para la misma entrada + versión) — no hay corrupción
 * posible, solo trabajo duplicado ocasional en el peor caso.
 */
async function generarYPersistirDerivado(
  buffer: Buffer,
  calcularRutaDestino: (extension: ExtensionDerivado) => string
): Promise<string | null> {
  try {
    const { buffer: optimizado, extension } = await optimizarImagenParaPdfPreview(buffer);
    const rutaDestino = calcularRutaDestino(extension);

    await fs.mkdir(path.dirname(rutaDestino), { recursive: true });

    const rutaTemporal = path.join(
      path.dirname(rutaDestino),
      `.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(rutaDestino)}`
    );
    await fs.writeFile(rutaTemporal, optimizado);
    try {
      await fs.rename(rutaTemporal, rutaDestino);
    } catch (error) {
      await fs.unlink(rutaTemporal).catch(() => {});
      throw error;
    }

    return rutaDestino;
  } catch (error) {
    console.warn('[pdfPreviewImage] No se pudo generar la versión optimizada para PDF', (error as Error)?.message ?? error);
    return null;
  }
}

async function obtenerRutaPdfPreviewLocal(rutaOriginalAbsoluta: string): Promise<string | null> {
  const calcularRuta = (extension: ExtensionDerivado) => calcularRutaDerivadaLocal(rutaOriginalAbsoluta, extension);

  const existente = await buscarDerivadoExistente(calcularRuta);
  if (existente) return existente;

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(rutaOriginalAbsoluta);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.warn('[pdfPreviewImage] No se pudo leer el original en disco', rutaOriginalAbsoluta, error);
    }
    return null;
  }

  return generarYPersistirDerivado(buffer, calcularRuta);
}

async function obtenerRutaPdfPreviewExterna(urlExterna: string): Promise<string | null> {
  const calcularRuta = (extension: ExtensionDerivado) => calcularRutaDerivadaExterna(urlExterna, extension);

  const existente = await buscarDerivadoExistente(calcularRuta);
  if (existente) return existente;

  try {
    // Timeout como protección: una URL externa que acepta la conexión pero
    // nunca responde no debe colgar la generación del PDF; una falla aquí se
    // degrada a "sin imagen" (ver obtenerRutaPdfPreview) en vez de propagarse.
    const response = await axios.get(urlExterna, {
      responseType: 'arraybuffer',
      timeout: PDF_PREVIEW_DOWNLOAD_TIMEOUT_MS,
    });
    const buffer = Buffer.from(response.data);
    return generarYPersistirDerivado(buffer, calcularRuta);
  } catch (error) {
    console.warn('[pdfPreviewImage] No se pudo descargar imagen externa para PDF', urlExterna, (error as Error)?.message ?? error);
    return null;
  }
}

/**
 * Punto de entrada único para obtener la ruta absoluta en disco de la
 * versión optimizada para PDF de `urlOriginal` (URL pública o ruta relativa
 * tipo /uploads/...). Si ya existe, la devuelve de inmediato sin ejecutar
 * Sharp. Si no existe, la genera, la persiste y la devuelve. Nunca lanza:
 * cualquier fallo se traduce en `null` para que el llamador continúe sin
 * imagen en vez de romper el PDF completo.
 *
 * Para URLs que resuelven dentro de uploads/, lee el original directamente
 * de disco (nunca hace una solicitud HTTP contra el propio dominio). Para
 * cualquier otra URL (externa legítima), usa descarga HTTP con timeout como
 * respaldo.
 */
export async function obtenerRutaPdfPreview(urlOriginal: string | null | undefined): Promise<string | null> {
  const valor = (urlOriginal ?? '').trim();
  if (!valor) return null;

  const rutaOriginalLocal = resolverRutaOriginalLocal(valor);
  if (rutaOriginalLocal) {
    return obtenerRutaPdfPreviewLocal(rutaOriginalLocal);
  }

  if (/^https?:\/\//i.test(valor)) {
    return obtenerRutaPdfPreviewExterna(valor);
  }

  // No es ni una ruta local válida de uploads/ ni una URL http(s) reconocible.
  return null;
}

/**
 * Genera de forma "best-effort" la versión optimizada para PDF de una imagen
 * recién subida. Nunca lanza: un fallo aquí no debe impedir que la subida del
 * original se considere exitosa. Si falla, la primera impresión que use esta
 * imagen la generará de forma perezosa (mismo código, vía
 * `obtenerRutaPdfPreview`).
 */
export async function generarPdfPreviewSiFalta(urlOriginal: string | null | undefined): Promise<void> {
  try {
    await obtenerRutaPdfPreview(urlOriginal);
  } catch (error) {
    console.warn('[pdfPreviewImage] Fallo generando PDF preview al subir imagen (no crítico)', (error as Error)?.message ?? error);
  }
}

/**
 * Elimina la versión optimizada de `urlOriginal` si existe, para usarse
 * únicamente donde el original físico correspondiente ya se está eliminando
 * (evita archivos derivados huérfanos). No hace nada si `urlOriginal` no
 * corresponde a un archivo local de uploads/.
 */
export async function eliminarPdfPreviewSiExiste(urlOriginal: string | null | undefined): Promise<void> {
  const valor = (urlOriginal ?? '').trim();
  if (!valor) return;

  const rutaOriginalLocal = resolverRutaOriginalLocal(valor);
  if (!rutaOriginalLocal) return;

  for (const extension of EXTENSIONES_DERIVADO) {
    const candidato = calcularRutaDerivadaLocal(rutaOriginalLocal, extension);
    try {
      await fs.unlink(candidato);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        console.warn('[pdfPreviewImage] No se pudo eliminar la versión optimizada', candidato, error);
      }
    }
  }
}
