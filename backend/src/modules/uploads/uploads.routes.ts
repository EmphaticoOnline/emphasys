import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import { subirImagen } from "./uploads.controller";
import { createDiskUploader, resolveUploadsDir } from "./uploads.multer";

const router = Router();

const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const upload = createDiskUploader({
  allowedMimeTypes: IMAGE_MIME_TYPES,
  maxFileSizeBytes: 5 * 1024 * 1024,
  destinationDir: resolveUploadsDir(),
});

const manejarUploadImagen = (req: Request, res: Response, next: NextFunction) => {
  const handler = upload.single("file");

  handler(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "El archivo excede el límite de 5MB" });
      }
      return res.status(400).json({ message: err.message });
    }

    if (err?.code === "INVALID_FILE_TYPE") {
      return res.status(400).json({ message: "Tipo de archivo no permitido" });
    }

    if (err) {
      console.error("Error al guardar archivo:", err);
      return res.status(500).json({ message: "Error al guardar archivo" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Archivo no enviado" });
    }

    return next();
  });
};

// Endpoint base: /api/uploads
router.post("/", manejarUploadImagen, subirImagen);

export default router;
