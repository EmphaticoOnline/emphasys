import type { User, Empresa } from "../session/sessionTypes";

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
