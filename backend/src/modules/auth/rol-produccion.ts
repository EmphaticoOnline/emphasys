import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import pool from "../../config/database";
import { AuthTokenPayload, obtenerJwtSecret } from "./auth.service";
import { normalizarRolNombre } from "./scope-comercial";

export const PRODUCCION_ROLE_NAMES = new Set(["produccion", "producción"]);

/**
 * Un usuario queda restringido al módulo de Producción sólo cuando TODOS sus roles
 * son "Producción". Si además tiene cualquier otro rol (Administrador, Operador,
 * Vendedor...), conserva el acceso que ese otro rol le da.
 */
export function esSoloRolProduccion(roleNames: string[]): boolean {
  const normalizados = roleNames.map(normalizarRolNombre);
  return normalizados.length > 0 && normalizados.every((nombre) => PRODUCCION_ROLE_NAMES.has(nombre));
}

// Endpoints que necesita la pantalla Ventas › Producción y el layout que la envuelve
// (sesión, marca de la empresa, tabs de Ventas, notificaciones push). Todo lo demás → 403.
const ENDPOINTS_PERMITIDOS: Array<{ metodos: string[]; patron: RegExp }> = [
  { metodos: ["GET"], patron: /^\/auth\/me$/ },
  { metodos: ["POST"], patron: /^\/auth\/(login|change-password)$/ },
  { metodos: ["GET"], patron: /^\/api\/runtime-info$/ },
  { metodos: ["GET"], patron: /^\/api\/version(\/.*)?$/ },
  { metodos: ["GET"], patron: /^\/api\/configuracion\/parametros$/ },
  { metodos: ["GET"], patron: /^\/api\/tipos-documento(\/habilitados)?$/ },
  { metodos: ["GET"], patron: /^\/api\/empresas\/\d+\/(assets\/[^/]+|identidad-visual)$/ },
  { metodos: ["GET", "POST", "PATCH", "DELETE"], patron: /^\/api\/notificaciones\/push(\/.*)?$/ },
  { metodos: ["GET"], patron: /^\/api\/produccion\/etapas$/ },
  { metodos: ["GET"], patron: /^\/api\/produccion\/seguimientos(\/documento\/\d+)?$/ },
  { metodos: ["GET"], patron: /^\/api\/produccion\/documentos\/\d+\/detalle$/ },
  { metodos: ["POST"], patron: /^\/api\/produccion\/seguimientos$/ },
  { metodos: ["PUT"], patron: /^\/api\/produccion\/seguimientos\/\d+$/ },
];

function endpointPermitido(metodo: string, ruta: string): boolean {
  const normalizada = ruta.length > 1 ? ruta.replace(/\/+$/, "") : ruta;
  return ENDPOINTS_PERMITIDOS.some((e) => e.metodos.includes(metodo) && e.patron.test(normalizada));
}

function leerToken(req: Request): AuthTokenPayload | null {
  const [scheme, token] = (req.get("authorization") ?? "").split(" ");
  if (!token || scheme?.toLowerCase() !== "bearer") return null;
  try {
    const decoded = jwt.verify(token, obtenerJwtSecret()) as jwt.JwtPayload & AuthTokenPayload;
    if (!decoded || typeof decoded !== "object" || decoded.userId === undefined) return null;
    return decoded;
  } catch {
    // Token inválido o expirado: lo rechaza requireAuth en la ruta correspondiente.
    return null;
  }
}

/**
 * Con X-Empresa-Id se evalúan los roles en esa empresa. Sin la cabecera (rutas que sólo
 * usan requireAuth) se evalúan todos sus roles en todas sus empresas, para que omitir la
 * cabecera no sirva para saltarse la restricción.
 */
async function obtenerNombresDeRol(userId: number, empresaId: number | null): Promise<string[]> {
  const { rows } = await pool.query<{ nombre: string }>(
    `SELECT r.nombre
       FROM core.usuarios_roles ur
       JOIN core.roles r ON r.id = ur.rol_id
      WHERE ur.usuario_id = $1
        AND ($2::int IS NULL OR ur.empresa_id = $2::int)
        AND r.activo = true
        AND r.empresa_id = ur.empresa_id`,
    [userId, empresaId]
  );
  return rows.map((row) => row.nombre);
}

/**
 * Middleware global (montado antes de los routers): si la petición trae un token de un
 * usuario cuyo único rol es "Producción", sólo deja pasar los endpoints de la lista
 * blanca. No autentica: peticiones sin token o con token inválido siguen su camino y las
 * rechaza requireAuth donde aplique.
 */
export async function restringirRolProduccion(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api/") && !req.path.startsWith("/auth/")) return next();

  const token = leerToken(req);
  if (!token || token.esSuperadmin) return next();

  try {
    const empresaHeader = Number(req.get("X-Empresa-Id"));
    const empresaId = Number.isFinite(empresaHeader) && empresaHeader > 0 ? empresaHeader : null;
    const roles = await obtenerNombresDeRol(Number(token.userId), empresaId);
    if (!esSoloRolProduccion(roles)) return next();
    if (endpointPermitido(req.method, req.path)) return next();
    return res.status(403).json({ message: "Tu rol sólo tiene acceso al módulo de Producción" });
  } catch (error) {
    console.error("Error en middleware restringirRolProduccion:", error);
    return res.status(500).json({ message: "No se pudo validar el acceso del rol" });
  }
}
