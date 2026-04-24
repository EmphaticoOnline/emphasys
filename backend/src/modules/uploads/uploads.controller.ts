import { Request, Response } from "express";

export function subirImagen(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ message: "Archivo no enviado" });
  }

  const baseUrl = process.env.APP_BASE_URL;
  let resolvedBaseUrl = baseUrl?.trim();

  if (!resolvedBaseUrl) {
    if (process.env.NODE_ENV !== "production") {
      console.error("APP_BASE_URL no está configurada. Usando fallback http://localhost:3001");
      resolvedBaseUrl = "http://localhost:3001";
    } else {
      console.error("APP_BASE_URL no está configurada en producción.");
      return res.status(500).json({ message: "APP_BASE_URL no configurada" });
    }
  }

  const url = `${resolvedBaseUrl.replace(/\/$/, "")}/uploads/${req.file.filename}`;
  return res.status(201).json({ url });
}
