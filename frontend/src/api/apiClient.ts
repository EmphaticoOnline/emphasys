const baseUrl = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "";

const SESSION_KEY = "emphasys.session";

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return { token: null, empresaActivaId: null };
    const parsed = JSON.parse(raw);
    return {
      token: parsed?.token ?? null,
      empresaActivaId: parsed?.empresaActivaId ?? null,
    };
  } catch (error) {
    console.warn("No se pudo leer la sesión almacenada", error);
    return { token: null, empresaActivaId: null };
  }
}

function buildUrl(path: string) {
  const trimmedBase = baseUrl?.toString().replace(/\/$/, "") || "";
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return `${trimmedBase}${path}`;
  return `${trimmedBase}/${path}`;
}

function mergeHeaders(extra?: HeadersInit) {
  const { token, empresaActivaId } = readSession();

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (empresaActivaId) headers.set("X-Empresa-Id", String(empresaActivaId));

  if (extra) {
    const extraHeaders = new Headers(extra);
    extraHeaders.forEach((value, key) => headers.set(key, value));
  }

  return headers;
}

export async function apiFetch(url: string, options: RequestInit = {}) {
  const finalUrl = buildUrl(url);
  const headers = mergeHeaders(options.headers);

  const response = await fetch(finalUrl, {
    ...options,
    headers,
  });

  return response;
}
