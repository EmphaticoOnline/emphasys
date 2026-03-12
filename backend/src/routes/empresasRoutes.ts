import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import { requireAuth } from "../modules/auth/auth.middleware";
import {
  actualizarEmpresaController,
  crearEmpresaController,
  eliminarEmpresaController,
  getEmpresaPorId,
  getEmpresas,
  obtenerAssetEmpresaController,
  subirAssetEmpresaController,
} from "../controllers/empresasController";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const manejarUploadAsset = (req: Request, res: Response, next: NextFunction) => {
  const handler = upload.single("archivo");
  handler(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "El archivo excede el límite de 5MB" });
      }
      return res.status(400).json({ message: err.message });
    }
    if (err) {
      return next(err);
    }
    return next();
  });
};

router.get("/", requireAuth, getEmpresas);
router.get("/:id", requireAuth, getEmpresaPorId);
router.post("/", requireAuth, crearEmpresaController);
router.put("/:id", requireAuth, actualizarEmpresaController);
router.delete("/:id", requireAuth, eliminarEmpresaController);
router.get("/:empresa_id/assets/:tipo", requireAuth, obtenerAssetEmpresaController);
router.post("/:empresa_id/assets", requireAuth, manejarUploadAsset, subirAssetEmpresaController);

export default router;
