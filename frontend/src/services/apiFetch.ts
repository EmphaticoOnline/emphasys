import type { SessionState } from "../session/sessionTypes";
import { clearSession } from "../session/sessionStorage";

const STORAGE_KEY = "emphasys.session";
const baseUrl = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL?.replace(/\/$/, "")) || "";

function buildUrl(path: string) {
  if (!path) return baseUrl;
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

function readSession(): SessionState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionState;
  } catch (err) {
    console.warn("No se pudo parsear la sesión almacenada, se limpia.", err);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function isJsonSerializable(body: ApiFetchOptions["body"]): body is Record<string, unknown> | unknown[] {
  if (body === null || body === undefined) return false;
  if (typeof body === "string") return false;
  if (body instanceof FormData) return false;
  if (body instanceof Blob) return false;
  if (body instanceof ArrayBuffer) return false;
  if (body instanceof URLSearchParams) return false;
  return typeof body === "object";
}

export type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
};

/**
 * Error lanzado por apiFetch en respuestas no-OK. `payload`/`status` son
 * aditivos (no rompen el uso existente de `error.message`): permiten a un
 * caller puntual leer campos extra del cuerpo de error, ej. un `code`
 * machine-readable, sin tener que rehacer el fetch a mano.
 */
export type ApiFetchError = Error & {
  status?: number;
  payload?: unknown;
};

export async function apiFetch<T>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const session = readSession();
  const finalUrl = buildUrl(url);

  const headers = new Headers(options.headers || {});

  if (session?.token) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }
  if (session?.empresaActivaId && !headers.has("X-Empresa-Id")) {
    headers.set("X-Empresa-Id", String(session.empresaActivaId));
  }

  let body = options.body;
  if (isJsonSerializable(body)) {
    headers.set("Content-Type", headers.get("Content-Type") || "application/json");
    body = JSON.stringify(body);
  }

  const response = await fetch(finalUrl, {
    ...options,
    headers,
    body: body ?? null,
  });

  if (response.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Sesión expirada");
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : await response.text().catch(() => "");

  if (!response.ok) {
    const message = (payload as any)?.message || (payload as any)?.error || (typeof payload === "string" ? payload : "Error de la API");
    const error = new Error(message || `Error HTTP ${response.status}`) as ApiFetchError;
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload as T;
}

export async function apiFetchBlob(url: string, options: ApiFetchOptions = {}): Promise<{ blob: Blob; filename: string }> {
  const session = readSession();
  const finalUrl = buildUrl(url);
  const headers = new Headers(options.headers || {});

  if (session?.token) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }
  if (session?.empresaActivaId && !headers.has("X-Empresa-Id")) {
    headers.set("X-Empresa-Id", String(session.empresaActivaId));
  }

  let body = options.body;
  if (isJsonSerializable(body)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  const response = await fetch(finalUrl, { ...options, headers, body: body ?? null });

  if (response.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Sesión expirada");
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let message = text;
    try { message = JSON.parse(text)?.message || text; } catch { /* no-op */ }
    throw new Error(message || `Error HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
  const filename = match?.[1] ? match[1].replace(/['"]/g, '') : 'exportacion.xlsx';

  return { blob, filename };
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
