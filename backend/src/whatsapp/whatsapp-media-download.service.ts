import axios from "axios";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { Readable } from "stream";
import { URL } from "url";
import { resolveUploadsDir } from "../modules/uploads/uploads.multer";
import { createValidatingLookup, SsrfBlockedError, validateUrlStructure } from "./ssrf-guard";
import { withDownloadConcurrencyLimit } from "./download-concurrency-limiter";

// Persistencia local de adjuntos ENTRANTES de WhatsApp (imagen/audio/documento,
// incluye video mapeado a 'document' — ver MEDIA_TYPE_MAP en whatsapp.mapper.ts).
//
// Este módulo NO toca la base de datos ni responde al webhook: solo sabe
// descargar una URL de Gupshup y, si pasa todas las validaciones, dejarla
// escrita de forma atómica dentro de la misma carpeta persistente que ya
// usa /api/uploads para adjuntos salientes. El orquestador (whatsappWebhook
// en conversaciones.controller.ts) decide cuándo llamarlo (en segundo plano,
// después de responder) y qué hacer con el resultado (actualizar
// crm.mensajes.media_url solo si hubo éxito).
//
// La URL recibida es dato NO CONFIABLE (viene del payload de un webhook
// externo): toda la protección SSRF (protocolo, credenciales embebidas,
// bloqueo de IPs privadas/reservadas, validación de cada redirección) vive
// en ./ssrf-guard.ts y se aplica aquí antes y durante la descarga.
//
// Todo error se resuelve como `{ ok: false, motivo }` — esta función NUNCA
// lanza. Quien la invoca igual debe tratarla como best-effort (no propagar
// el error hacia arriba de forma que pueda tumbar el proceso).

// Mismo catálogo de tipos que ya acepta /api/uploads (DEFAULT_UPLOAD_MIME_TYPES
// en uploads.multer.ts): solo se descargan adjuntos de tipos que el resto del
// sistema ya sabe manejar y que el ERP ya es capaz de reenviar como mensaje de
// WhatsApp (sendDocumentMessage/sendImageMessage/sendAudioMessage no
// discriminan por mimetype, así que el techo real de "qué puede enviar el
// ERP por WhatsApp" es justo lo que acepta /api/uploads). Se revisó el resto
// del backend (reportes, contabilidad, CFDI) en busca de xlsx/csv/xml/zip/ppt
// usados como adjunto saliente de WhatsApp: esos formatos solo existen ahí
// como descargas directas para el usuario (Content-Type de respuesta HTTP),
// nunca como `media_url` de un mensaje — por eso NO se agregan aquí: hacerlo
// crearía la asimetría inversa (se podría recibir un tipo que el ERP nunca
// podría reenviar).
const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "audio/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
};

const ALLOWED_MIME_TYPES = new Set(Object.keys(MIME_TO_EXTENSION));

const DOWNLOAD_TIMEOUT_MS = 15_000;
const MAX_REDIRECT_HOPS = 3;
// Techo de tamaño para un adjunto entrante de WhatsApp (imagen/audio/documento).
// Holgado sobre los límites típicos de WhatsApp Business API, pero acotado
// para no permitir una descarga descontrolada en memoria/disco.
const MAX_BYTES = 20 * 1024 * 1024;

function resolveAppBaseUrlForBackgroundJob(): string | null {
  const raw = process.env.APP_BASE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  // Mismo criterio que uploads.controller.ts: solo se permite el fallback a
  // localhost fuera de producción. En producción sin APP_BASE_URL configurada
  // no se arma una URL con un host inventado: se aborta la persistencia local
  // y el mensaje conserva la URL original de Gupshup.
  if (process.env.NODE_ENV !== "production") return "http://localhost:3001";
  return null;
}

// Nunca se debe loguear la URL completa de un adjunto de Gupshup (puede traer
// tokens/firmas en el query string). Se recorta antes de cualquier log.
function redactUrlForLog(url: string): string {
  return url.split("?")[0] || url;
}

function describirErrorDescarga(error: unknown): string {
  if (error instanceof SsrfBlockedError) {
    // El mensaje de SsrfBlockedError ya está diseñado para ser seguro de
    // loguear (no incluye la URL completa ni datos sensibles).
    return error.message;
  }
  if (error && typeof error === "object" && "name" in error && (error as any).name === "CanceledError") {
    return "timeout o cancelación de la descarga";
  }
  const err = error as any;
  if (err?.code) return `error de red (${err.code})`;
  if (err?.response?.status) return `respuesta HTTP ${err.response.status}`;
  if (err?.message) return String(err.message).slice(0, 200);
  return "error desconocido";
}

type StreamResponse = { status: number; headers: Record<string, any>; data: Readable };

/**
 * GET con protección SSRF completa: valida estructura (protocolo,
 * credenciales, allowlist) y resuelve/valida la IP de forma atómica con la
 * conexión (createValidatingLookup) en CADA salto, incluida cada
 * redirección. El auto-seguimiento de redirecciones de axios está
 * desactivado (`maxRedirects: 0`) a propósito: las redirecciones se
 * manejan aquí mismo, re-validando el destino desde cero antes de
 * seguirlo, hasta un máximo de MAX_REDIRECT_HOPS saltos.
 */
async function fetchStreamConSsrfGuard(initialUrl: string, signal: AbortSignal): Promise<StreamResponse> {
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    validateUrlStructure(currentUrl);

    const response = await axios.get(currentUrl, {
      responseType: "stream",
      timeout: DOWNLOAD_TIMEOUT_MS,
      maxRedirects: 0,
      signal,
      lookup: createValidatingLookup() as any,
      validateStatus: () => true,
      headers: { "User-Agent": "EmphasysERP-MediaFetcher/1.0" },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.location as string | undefined;
      response.data.destroy();
      if (!location) {
        throw new Error(`redirección sin Location (HTTP ${response.status})`);
      }
      // Resuelve relativas contra la URL actual, igual que un navegador.
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      response.data.destroy();
      throw new Error(`HTTP ${response.status}`);
    }

    return response;
  }

  throw new Error(`demasiadas redirecciones (máximo ${MAX_REDIRECT_HOPS})`);
}

export type DescargaAdjuntoParams = {
  empresaId: number;
  mediaUrl: string;
  mimeTypeHint: string | null;
};

export type DescargaAdjuntoResultado =
  | { ok: true; url: string }
  | { ok: false; motivo: string };

/**
 * Descarga por streaming (nunca carga el archivo completo en memoria),
 * valida tipo MIME real (por Content-Type de la respuesta, con el hint del
 * webhook solo como respaldo) y tamaño máximo, y escribe el resultado de
 * forma atómica (archivo temporal + rename) dentro de
 * `<uploadsDir>/whatsapp-entrante/<empresaId>/`. Devuelve la URL pública
 * final (misma convención que /api/uploads) o un motivo de fallo — nunca
 * lanza una excepción. Respeta el límite global de concurrencia (ver
 * download-concurrency-limiter.ts).
 */
export async function descargarYPersistirAdjuntoEntrante(
  params: DescargaAdjuntoParams
): Promise<DescargaAdjuntoResultado> {
  return withDownloadConcurrencyLimit(() => ejecutarDescarga(params));
}

async function ejecutarDescarga(params: DescargaAdjuntoParams): Promise<DescargaAdjuntoResultado> {
  const baseUrl = resolveAppBaseUrlForBackgroundJob();
  if (!baseUrl) {
    return { ok: false, motivo: "APP_BASE_URL no configurada" };
  }

  try {
    validateUrlStructure(params.mediaUrl);
  } catch (error) {
    return { ok: false, motivo: describirErrorDescarga(error) };
  }

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    let response: StreamResponse;
    try {
      response = await fetchStreamConSsrfGuard(params.mediaUrl, controller.signal);
    } catch (error) {
      return { ok: false, motivo: describirErrorDescarga(error) };
    }

    const contentTypeHeader = String(response.headers["content-type"] || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const mimeTypeHint = params.mimeTypeHint?.toLowerCase().trim() || null;

    // No confiar únicamente en lo que dice el webhook (mimeTypeHint): se
    // prioriza el Content-Type real que devuelve el servidor de medios: si
    // ninguno de los dos está en la lista permitida, se rechaza.
    const mimeType = ALLOWED_MIME_TYPES.has(contentTypeHeader)
      ? contentTypeHeader
      : mimeTypeHint && ALLOWED_MIME_TYPES.has(mimeTypeHint)
        ? mimeTypeHint
        : null;

    if (!mimeType) {
      response.data.destroy();
      return {
        ok: false,
        motivo: `tipo de contenido no permitido (content-type=${contentTypeHeader || "desconocido"})`,
      };
    }

    const contentLengthHeader = response.headers["content-length"];
    if (contentLengthHeader && Number(contentLengthHeader) > MAX_BYTES) {
      response.data.destroy();
      return { ok: false, motivo: "archivo excede el tamaño máximo permitido" };
    }

    const extension = MIME_TO_EXTENSION[mimeType];
    const uploadsDir = resolveUploadsDir();
    const empresaDir = path.join(uploadsDir, "whatsapp-entrante", String(params.empresaId));
    const resolvedEmpresaDir = path.resolve(empresaDir);

    // El nombre físico es 100% generado por el servidor (timestamp + bytes
    // aleatorios); nunca se usa el nombre de archivo ni el caption que venga
    // en el payload de Gupshup para construir la ruta en disco.
    const filenameBase = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    const finalPath = path.join(empresaDir, `${filenameBase}${extension}`);
    const resolvedFinal = path.resolve(finalPath);

    // Defensa adicional anti path-traversal: aunque empresaId siempre es un
    // entero validado antes de llegar aquí y el nombre es generado por
    // nosotros (sin separadores posibles), se verifica igualmente que la
    // ruta final quede dentro del directorio de la empresa antes de escribir.
    if (!resolvedFinal.startsWith(resolvedEmpresaDir + path.sep)) {
      response.data.destroy();
      return { ok: false, motivo: "ruta de destino inválida" };
    }

    await fs.promises.mkdir(empresaDir, { recursive: true });
    const tempPath = path.join(empresaDir, `.tmp-${process.pid}-${filenameBase}${extension}`);

    let bytesWritten = 0;
    try {
      await new Promise<void>((resolve, reject) => {
        const writeStream = fs.createWriteStream(tempPath);
        let settled = false;
        const fail = (error: Error) => {
          if (settled) return;
          settled = true;
          response.data.destroy();
          writeStream.destroy();
          reject(error);
        };

        response.data.on("data", (chunk: Buffer) => {
          bytesWritten += chunk.length;
          if (bytesWritten > MAX_BYTES) {
            fail(new Error("MAX_BYTES_EXCEEDED"));
          }
        });
        response.data.on("error", fail);
        writeStream.on("error", fail);
        writeStream.on("finish", () => {
          if (settled) return;
          settled = true;
          resolve();
        });

        response.data.pipe(writeStream);
      });
    } catch (error) {
      await fs.promises.unlink(tempPath).catch(() => {});
      return { ok: false, motivo: describirErrorDescarga(error) };
    }

    try {
      // Mismo patrón ya usado en pdfPreviewImage.service.ts: archivo temporal
      // en el mismo directorio + rename atómico, para que ningún lector
      // concurrente (p. ej. un reenvío que consulte media_url) pueda ver un
      // archivo a medio escribir.
      await fs.promises.rename(tempPath, finalPath);
    } catch {
      await fs.promises.unlink(tempPath).catch(() => {});
      return { ok: false, motivo: "no se pudo finalizar el archivo local" };
    }

    const relativeUrlPath = path.relative(uploadsDir, finalPath).split(path.sep).join("/");
    return { ok: true, url: `${baseUrl}/uploads/${relativeUrlPath}` };
  } catch (error) {
    // Red de seguridad final: cualquier error no anticipado se degrada a
    // fallo best-effort en vez de propagarse.
    console.error("[WhatsApp Media Download] Error inesperado", {
      empresaId: params.empresaId,
      mediaUrl: redactUrlForLog(params.mediaUrl),
      error: (error as Error)?.message,
    });
    return { ok: false, motivo: "error inesperado" };
  } finally {
    clearTimeout(deadline);
  }
}

export { redactUrlForLog };
