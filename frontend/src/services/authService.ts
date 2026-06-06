import type { User, Empresa } from "../session/sessionTypes";
import { apiFetch } from "./apiFetch";

const baseUrl = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL?.replace(/\/$/, "")) || "";

type LoginResponse = {
  token: string;
  user: User;
  empresas: Empresa[];
};

export async function login(email: string, password: string): Promise<LoginResponse> {
  const url = `${baseUrl}/auth/login`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(text || `Error al iniciar sesión (status ${resp.status})`);
  }

  return resp.json();
}

export async function cambiarPassword(passwordActual: string, passwordNueva: string): Promise<void> {
  await apiFetch<void>("/auth/change-password", {
    method: "POST",
    body: { passwordActual, passwordNueva } as any,
  });
}
