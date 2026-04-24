import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";

export type DiskUploadOptions = {
  allowedMimeTypes: string[];
  maxFileSizeBytes: number;
  destinationDir?: string;
};

export const DEFAULT_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "audio/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
];

export function resolveUploadsDir(): string {
  return process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.resolve(process.cwd(), "uploads");
}

export function createDiskUploader({
  allowedMimeTypes,
  maxFileSizeBytes,
  destinationDir = resolveUploadsDir(),
}: DiskUploadOptions) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        fs.mkdirSync(destinationDir, { recursive: true });
        cb(null, destinationDir);
      } catch (error) {
        cb(error as Error, destinationDir);
      }
    },
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const uniqueId = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
      cb(null, `${uniqueId}${extension}`);
    },
  });

  const fileFilter: multer.Options["fileFilter"] = (_req, file, cb: multer.FileFilterCallback) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      const error = new Error("Tipo de archivo no permitido");
      (error as NodeJS.ErrnoException).code = "INVALID_FILE_TYPE";
      return cb(error);
    }
    return cb(null, true);
  };

  return multer({
    storage,
    limits: { fileSize: maxFileSizeBytes },
    fileFilter,
  });
}
