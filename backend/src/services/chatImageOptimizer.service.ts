import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';

/**
 * Optimiza automáticamente una imagen recién subida para su uso en el chat
 * de WhatsApp del ERP: aplica la orientación EXIF físicamente (mismo
 * mecanismo que ya usaba imageOrientationNormalizer.service.ts, ahora
 * incorporado aquí), limita el lado mayor a un tamaño razonable para
 * mensajería y recomprime con una calidad visualmente indistinguible.
 *
 * Por qué existe: una fotografía de cámara de teléfono actual pesa
 * típicamente varios MB a resolución nativa (10-48 MP). Ni WhatsApp ni la
 * burbuja del chat del ERP necesitan esa resolución — el resultado de
 * servir el archivo tal cual es una descarga lenta que el navegador pinta
 * de forma progresiva ("barrido") mientras llega. Reducir el lado mayor a
 * CHAT_IMAGE_MAX_DIMENSION_PX antes de guardar el archivo elimina ese
 * cuello de botella de raíz, sin tocar el componente de React (que además
 * se corrige por separado para no revelar imágenes a medio pintar).
 *
 * Mismo archivo para WhatsApp y para el ERP (no existen dos URLs distintas
 * hoy: ambos consumen /uploads/<filename>), así que esta es la única
 * optimización necesaria — no hay que generar un derivado aparte. El
 * archivo resultante conserva el mismo nombre/extensión/formato que el
 * original (JPEG→JPEG, PNG→PNG, WebP→WebP): nunca cambia el Content-Type
 * que Express sirve para esa URL.
 *
 * Solo actúa sobre imágenes nuevas: se invoca exclusivamente desde el
 * endpoint de subida, nunca reprocesa archivos ya existentes.
 */

// 2048px en el lado mayor: nítido incluso a pantalla completa en cualquier
// teléfono actual, muy por debajo de los 3000-8000px típicos de una foto de
// cámara sin recortar visualmente nada perceptible en una burbuja de chat.
const CHAT_IMAGE_MAX_DIMENSION_PX = 2048;
// mozjpeg + calidad 82: estándar de facto para fotografías en apps de
// mensajería — visualmente indistinguible del original a este tamaño de
// visualización, con una reducción de peso muy significativa.
const CHAT_IMAGE_JPEG_QUALITY = 82;

export async function optimizarImagenParaChatSiAplica(filePath: string): Promise<void> {
  try {
    const original = await fs.readFile(filePath);
    const metadata = await sharp(original, { failOn: 'none' }).metadata();

    const necesitaRotacion = Boolean(metadata.orientation) && metadata.orientation !== 1;
    // Un giro de 90°/270° intercambia width/height pero no cambia el
    // conjunto {width, height}: comparar cada dimensión contra el máximo
    // (un límite cuadrado, aplicado igual a ambos lados en el resize de
    // abajo) da el mismo resultado se rote o no, sin necesidad de predecir
    // el intercambio.
    const necesitaResize = Boolean(
      (metadata.width && metadata.width > CHAT_IMAGE_MAX_DIMENSION_PX) ||
      (metadata.height && metadata.height > CHAT_IMAGE_MAX_DIMENSION_PX)
    );

    // Ni orientación que corregir ni tamaño que reducir: no se re-codifica
    // el archivo para no introducir ninguna pérdida de calidad en imágenes
    // que ya eran óptimas para chat.
    if (!necesitaRotacion && !necesitaResize) {
      return;
    }

    let pipeline = sharp(original, { failOn: 'none' })
      .rotate()
      .resize({
        width: CHAT_IMAGE_MAX_DIMENSION_PX,
        height: CHAT_IMAGE_MAX_DIMENSION_PX,
        fit: 'inside',
        withoutEnlargement: true,
      });

    let optimizado: Buffer;
    if (metadata.format === 'png') {
      optimizado = await pipeline.png({ compressionLevel: 9 }).toBuffer();
    } else if (metadata.format === 'webp') {
      optimizado = await pipeline.webp({ quality: CHAT_IMAGE_JPEG_QUALITY }).toBuffer();
    } else {
      // JPEG (o cualquier otro formato que Sharp decodifique como tal).
      optimizado = await pipeline
        .jpeg({ quality: CHAT_IMAGE_JPEG_QUALITY, chromaSubsampling: '4:2:0', mozjpeg: true })
        .toBuffer();
    }

    // Escritura a archivo temporal + rename atómico: un lector concurrente
    // (p. ej. el envío a WhatsApp disparado justo después de subir, o
    // generarPdfPreviewSiFalta) nunca ve el archivo a medio escribir.
    const rutaTemporal = path.join(
      path.dirname(filePath),
      `.tmp-chatimg-${process.pid}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(filePath)}`
    );
    await fs.writeFile(rutaTemporal, optimizado);
    try {
      await fs.rename(rutaTemporal, filePath);
    } catch (error) {
      await fs.unlink(rutaTemporal).catch(() => {});
      throw error;
    }
  } catch (error) {
    // Best-effort: si falla la optimización, el original tal como se subió
    // se sigue sirviendo igual que antes de este cambio — no se bloquea la
    // subida.
    console.warn(
      '[chatImageOptimizer] No se pudo optimizar la imagen para chat',
      filePath,
      (error as Error)?.message ?? error
    );
  }
}
