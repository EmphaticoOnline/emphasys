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

function isJsonSerializable(body: any) {
  if (body === null || body === undefined) return false;
  if (typeof body === "string") return false;
  if (body instanceof FormData) return false;
  if (body instanceof Blob) return false;
  if (body instanceof ArrayBuffer) return false;
  if (body instanceof URLSearchParams) return false;
  return typeof body === "object";
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const session = readSession();
  const finalUrl = buildUrl(url);

  const headers = new Headers(options.headers || {});

  if (session?.token) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }
  if (session?.empresaActivaId) {
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
    throw new Error(message || `Error HTTP ${response.status}`);
  }

  return payload as T;
}
