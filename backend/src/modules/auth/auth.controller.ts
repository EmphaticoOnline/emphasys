import { Request, Response } from "express";
import {
  construirPayloadToken,
  generarToken,
  mapearUsuarioPublico,
  normalizarEmailLogin,
  obtenerEmpresasActivasDeUsuario,
  obtenerRolesDeUsuarioEnEmpresa,
  obtenerUsuarioPorEmail,
  obtenerUsuarioPorId,
  registrarUltimoLogin,
  validarPassword,
} from "./auth.service";

export async function login(req: Request, res: Response) {
  try {
    const rawEmail = req.body?.email;
    const password: string | undefined = req.body?.password;

    const email = normalizarEmailLogin(typeof rawEmail === "string" ? rawEmail : "");

    if (!email || !password) {
      return res.status(400).json({ message: "email y password son requeridos" });
    }

    const usuario = await obtenerUsuarioPorEmail(email);

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const passwordValido = await validarPassword(password, usuario.password_hash);

    if (!passwordValido) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const userPublico = mapearUsuarioPublico(usuario);
    const tokenPayload = construirPayloadToken(userPublico);
    const token = generarToken(tokenPayload);

    const empresas = await obtenerEmpresasActivasDeUsuario(usuario.id);

    await registrarUltimoLogin(usuario.id);

    return res.json({
      token,
      user: {
        id: userPublico.id,
        nombre: userPublico.nombre,
        email: userPublico.email,
        es_superadmin: userPublico.es_superadmin,
      },
      empresas,
    });
  } catch (error) {
    console.error("Error en /auth/login:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function me(req: Request, res: Response) {
  try {
    const auth = req.auth;

    if (!auth) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const usuario = await obtenerUsuarioPorId(auth.userId);

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ message: "Usuario no encontrado o inactivo" });
    }

    const empresas = await obtenerEmpresasActivasDeUsuario(usuario.id);

    const empresaId = req.context?.empresaId;
    if (!empresaId || Number.isNaN(Number(empresaId))) {
      return res.status(400).json({ message: "X-Empresa-Id es requerido" });
    }

    const empresaActiva = empresas.find((e) => e.id === empresaId);

    if (!empresaActiva) {
      return res.status(403).json({ message: "No tienes acceso a la empresa seleccionada" });
    }

    const roles = await obtenerRolesDeUsuarioEnEmpresa(usuario.id, empresaId);

    return res.json({
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        es_superadmin: usuario.es_superadmin,
      },
      empresas,
      empresaActiva,
      roles,
    });
  } catch (error) {
    console.error("Error en /auth/me:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}
