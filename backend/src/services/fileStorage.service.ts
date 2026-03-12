import fs from "fs/promises";
import path from "path";
import type { Express } from "express";

const DEFAULT_UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
const ENV_UPLOADS_DIR = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : null;

function sanitizeFolderName(name: string): string {
  const safe = name.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return safe || "empresa";
}

function sanitizeFilename(originalName: string): string {
  const base = path.basename(originalName || "archivo");
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");

  if (cleaned.length === 0) {
    return `archivo_${Date.now()}`;
  }

  // Evita nombres demasiado largos que puedan romper el FS
  return cleaned.slice(0, 255);
}

export type SaveEmpresaFileParams = {
  empresaIdentificador: string;
  file: Express.Multer.File;
  uploadsRoot?: string;
};

export type SavedFileInfo = {
  absolutePath: string;
  relativePath: string;
  filename: string;
  mimeType: string;
  size: number;
};

export async function saveEmpresaFile({ empresaIdentificador, file, uploadsRoot }: SaveEmpresaFileParams): Promise<SavedFileInfo> {
  const uploadsDir = uploadsRoot ? path.resolve(uploadsRoot) : ENV_UPLOADS_DIR ?? DEFAULT_UPLOADS_DIR;
  const empresaDir = path.join(uploadsDir, "empresas", sanitizeFolderName(empresaIdentificador));

  await fs.mkdir(empresaDir, { recursive: true });

  const filename = sanitizeFilename(file.originalname);
  const absolutePath = path.join(empresaDir, filename);

  await fs.writeFile(absolutePath, file.buffer);

  const relativePath = path
    .join("/uploads/empresas", sanitizeFolderName(empresaIdentificador), filename)
    .replace(/\\/g, "/");

  return {
    absolutePath,
    relativePath,
    filename,
    mimeType: file.mimetype,
    size: file.size,
  };
}

export async function removeFileIfExists(absolutePath: string): Promise<void> {
  try {
    await fs.unlink(absolutePath);
  } catch (error: any) {
    if (error && error.code === "ENOENT") return;
    console.warn("No se pudo eliminar el archivo", absolutePath, error);
  }
}
