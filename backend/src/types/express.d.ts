import type { AuthTokenPayload } from "../modules/auth/auth.service";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
      context?: {
        empresaId: number;
        empresaIdentificador?: string;
        empresaNombre?: string;
      };
    }
  }
}

export {};
