import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import pool from "../../config/database";
import { normalizeEmail } from "../../shared/normalizers/email";

export interface AuthTokenPayload {
  userId: number;
  email: string;
  esSuperadmin: boolean;
}

export interface UsuarioConPassword {
  id: number;
  nombre: string;
  email: string;
  password_hash: string;
  activo: boolean;
  es_superadmin: boolean;
  vendedor_contacto_id: number | null;
  vendedor_contacto_nombre: string | null;
}

export interface UsuarioPublico {
  id: number;
  nombre: string;
  email: string;
  activo: boolean;
  es_superadmin: boolean;
  vendedor_contacto_id: number | null;
  vendedor_contacto_nombre: string | null;
}

export interface EmpresaResumen {
  id: number;
  identificador: string;
  nombre: string;
}

export interface RolResumen {
  id: number;
  nombre: string;
  descripcion: string | null;
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.JWT_SECRET_KEY;

  if (!secret) {
    throw new Error("JWT_SECRET no configurado");
  }

  return secret;
}

export function obtenerJwtSecret(): string {
  return getJwtSecret();
}

export function generarToken(payload: AuthTokenPayload): string {
  const expiresIn: SignOptions["expiresIn"] = JWT_EXPIRES_IN as SignOptions["expiresIn"];
  const options: SignOptions = { expiresIn };
  return jwt.sign(payload, getJwtSecret(), options);
}

export function construirPayloadToken(usuario: UsuarioPublico): AuthTokenPayload {
  return {
    userId: usuario.id,
    email: usuario.email,
    esSuperadmin: usuario.es_superadmin,
  };
}

export function mapearUsuarioPublico<T extends { id: number; nombre: string; email: string; es_superadmin: boolean; activo?: boolean; vendedor_contacto_id?: number | null; vendedor_contacto_nombre?: string | null }>(usuario: T): UsuarioPublico {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    es_superadmin: usuario.es_superadmin,
    activo: usuario.activo ?? true,
    vendedor_contacto_id: usuario.vendedor_contacto_id ?? null,
    vendedor_contacto_nombre: usuario.vendedor_contacto_nombre ?? null,
  };
}

export function normalizarEmailLogin(email: string): string | null {
  return normalizeEmail(email);
}

export async function obtenerUsuarioPorEmail(email: string): Promise<UsuarioConPassword | null> {
  const { rows } = await pool.query<UsuarioConPassword>(
    `SELECT u.id,
      u.nombre,
      u.email,
      u.password_hash,
      u.activo,
      u.es_superadmin,
      u.vendedor_contacto_id,
      c.nombre AS vendedor_contacto_nombre
       FROM core.usuarios u
       LEFT JOIN public.contactos c ON c.id = u.vendedor_contacto_id
      WHERE lower(u.email) = lower($1)
      LIMIT 1`,
    [email]
  );

  return rows[0] ?? null;
}

export async function obtenerUsuarioPorId(id: number): Promise<UsuarioPublico | null> {
  const { rows } = await pool.query<UsuarioPublico>(
    `SELECT u.id,
      u.nombre,
      u.email,
      u.activo,
      u.es_superadmin,
      u.vendedor_contacto_id,
      c.nombre AS vendedor_contacto_nombre
       FROM core.usuarios u
       LEFT JOIN public.contactos c ON c.id = u.vendedor_contacto_id
      WHERE u.id = $1
      LIMIT 1`,
    [id]
  );

  return rows[0] ?? null;
}

export async function validarPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function obtenerEmpresasActivasDeUsuario(usuarioId: number): Promise<EmpresaResumen[]> {
  const { rows } = await pool.query<EmpresaResumen>(
    `SELECT e.id, e.identificador, e.nombre
       FROM core.usuarios_empresas ue
       JOIN core.empresas e ON e.id = ue.empresa_id
      WHERE ue.usuario_id = $1
        AND ue.activo = true
        AND e.activo = true
      ORDER BY e.nombre ASC`,
    [usuarioId]
  );

  return rows;
}

export async function obtenerEmpresaActivaDeUsuario(usuarioId: number, empresaId: number): Promise<EmpresaResumen | null> {
  const { rows } = await pool.query<EmpresaResumen>(
    `SELECT e.id, e.identificador, e.nombre
       FROM core.usuarios_empresas ue
       JOIN core.empresas e ON e.id = ue.empresa_id
      WHERE ue.usuario_id = $1
        AND ue.empresa_id = $2
        AND ue.activo = true
        AND e.activo = true
      LIMIT 1`,
    [usuarioId, empresaId]
  );

  return rows[0] ?? null;
}

export async function obtenerRolesDeUsuarioEnEmpresa(usuarioId: number, empresaId: number): Promise<RolResumen[]> {
  const { rows } = await pool.query<RolResumen>(
    `SELECT r.id, r.nombre, r.descripcion
       FROM core.usuarios_roles ur
       JOIN core.roles r ON r.id = ur.rol_id
      WHERE ur.usuario_id = $1
        AND ur.empresa_id = $2
        AND r.activo = true
        AND r.empresa_id = ur.empresa_id
      ORDER BY r.nombre ASC`,
    [usuarioId, empresaId]
  );

  return rows;
}

export async function registrarUltimoLogin(usuarioId: number): Promise<void> {
  await pool.query(
    `UPDATE core.usuarios
        SET ultimo_login = now()
      WHERE id = $1`,
    [usuarioId]
  );
}
