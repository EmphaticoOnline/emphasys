import type { AuthTokenPayload } from "../modules/auth/auth.service";
import type { File as MulterFile } from "multer";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
      context?: {
        empresaId: number;
        empresaIdentificador?: string;
        empresaNombre?: string;
      };
      file?: MulterFile;
    }
  }
}

export {};
