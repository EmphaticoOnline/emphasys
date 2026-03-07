import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import pool from "../../config/database";
import { AuthTokenPayload, EmpresaResumen, obtenerEmpresaActivaDeUsuario, obtenerJwtSecret } from "./auth.service";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.get("authorization");

    if (!header) {
      return res.status(401).json({ message: "Authorization header requerido" });
    }

    const [scheme, token] = header.split(" ");

    if (!token || scheme?.toLowerCase() !== "bearer") {
      return res.status(401).json({ message: "Formato de autorización inválido" });
    }

    const decoded = jwt.verify(token, obtenerJwtSecret()) as jwt.JwtPayload & AuthTokenPayload;

    if (!decoded || typeof decoded !== "object" || decoded.userId === undefined) {
      return res.status(401).json({ message: "Token inválido" });
    }

    req.auth = {
      userId: Number(decoded.userId),
      email: decoded.email,
      esSuperadmin: Boolean(decoded.esSuperadmin),
    };

    return next();
  } catch (error) {
    console.error("Error en middleware requireAuth:", error);
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
}

export async function requireEmpresaActiva(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const empresaHeader = req.get("X-Empresa-Id");

    if (!empresaHeader) {
      return res.status(400).json({ message: "X-Empresa-Id es requerido" });
    }

    const empresaId = Number(empresaHeader);

    if (!Number.isFinite(empresaId)) {
      return res.status(400).json({ message: "X-Empresa-Id debe ser numérico" });
    }

    let empresa: EmpresaResumen | null = null;

    if (req.auth.esSuperadmin) {
      empresa = await obtenerEmpresaActivaPorId(empresaId);
    } else {
      empresa = await obtenerEmpresaActivaDeUsuario(req.auth.userId, empresaId);
    }

    if (!empresa) {
      return res.status(403).json({ message: "No tienes acceso a la empresa indicada" });
    }

    req.context = {
      empresaId: empresa.id,
      empresaIdentificador: empresa.identificador,
      empresaNombre: empresa.nombre,
    };

    return next();
  } catch (error) {
    console.error("Error en middleware requireEmpresaActiva:", error);
    return res.status(500).json({ message: "Error al validar empresa activa" });
  }
}

export async function obtenerEmpresaActivaPorId(empresaId: number): Promise<EmpresaResumen | null> {
  const { rows } = await pool.query<EmpresaResumen>(
    `SELECT id, identificador, nombre
       FROM core.empresas
      WHERE id = $1
        AND activo = true
      LIMIT 1`,
    [empresaId]
  );

  return rows[0] ?? null;
}