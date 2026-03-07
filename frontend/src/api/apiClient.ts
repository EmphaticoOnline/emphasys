const baseUrl = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "";

function buildUrl(path: string) {
  const trimmedBase = baseUrl?.toString().replace(/\/$/, "") || "";
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return `${trimmedBase}${path}`;
  return `${trimmedBase}/${path}`;
}

function mergeHeaders(extra?: HeadersInit) {
  const token = localStorage.getItem("token");
  const empresaId = localStorage.getItem("empresaActivaId");

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (empresaId) headers.set("X-Empresa-Id", empresaId);

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
