import { Request, Response } from "express";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

const SUPPORTED_AUDIO_MIME_TYPES = new Set(["audio/mpeg"]);

const convertAudioToMp3 = (inputPath: string, outputPath: string) =>
  new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(["-vn", "-acodec libmp3lame", "-b:a 128k"])
      .on("error", (error: Error) => reject(error))
      .on("end", () => resolve())
      .save(outputPath);
  });

export async function subirImagen(req: Request, res: Response) {
  console.log("[Uploads] Solicitud recibida", {
    originalName: req.file?.originalname ?? null,
    mimetype: req.file?.mimetype ?? null,
    size: req.file?.size ?? null,
  });

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

  let filename = req.file.filename;

  if (req.file.mimetype?.startsWith("audio/") && !SUPPORTED_AUDIO_MIME_TYPES.has(req.file.mimetype)) {
    try {
      const parsed = path.parse(req.file.filename);
      const mp3Filename = `${parsed.name}.mp3`;
      const outputPath = path.join(path.dirname(req.file.path), mp3Filename);

      console.log("[Uploads] Convirtiendo audio a mp3", {
        input: req.file.path,
        output: outputPath,
        mimetype: req.file.mimetype,
      });

      await convertAudioToMp3(req.file.path, outputPath);
      filename = mp3Filename;
    } catch (error) {
      console.error("[Uploads] Error convirtiendo audio a mp3", error);
      return res.status(500).json({ message: "No se pudo convertir el audio" });
    }
  }

  const url = `${resolvedBaseUrl.replace(/\/$/, "")}/uploads/${filename}`;
  return res.status(201).json({ url });
}
