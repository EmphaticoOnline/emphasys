import type { SessionState } from "./sessionTypes";

const STORAGE_KEY = "emphasys.session";

export function saveSession(session: SessionState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function loadSession(): SessionState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      token: null,
      user: null,
      empresas: [],
      empresaActivaId: null,
    };
  }

  try {
    const parsed = JSON.parse(raw) as SessionState;
    return {
      token: parsed?.token ?? null,
      user: parsed?.user ?? null,
      empresas: parsed?.empresas ?? [],
      empresaActivaId: parsed?.empresaActivaId ?? null,
    };
  } catch (error) {
    console.warn("No se pudo parsear la sesión almacenada, se limpia.", error);
    clearSession();
    return {
      token: null,
      user: null,
      empresas: [],
      empresaActivaId: null,
    };
  }
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}
