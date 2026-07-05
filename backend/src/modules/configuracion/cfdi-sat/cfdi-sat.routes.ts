import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { requireAuth, requireEmpresaActiva } from '../../auth/auth.middleware';
import {
  eliminarCredencialesController,
  obtenerCredencialesController,
  subirCredencialesController,
} from './cfdi-sat-credenciales.controller';
import { aceptarAutorizacionController, obtenerAutorizacionController } from './cfdi-sat-autorizacion.controller';
import {
  crearSolicitudController,
  descargarSolicitudController,
  listarPaquetesDeSolicitudController,
  listarSolicitudesController,
  verificarSolicitudController,
} from './cfdi-sat-solicitudes.controller';
import {
  descargarXmlComprobanteController,
  importarComprobanteComprasController,
  importarComprobantesLoteController,
  listarCandidatosVinculacionController,
  listarComprobantesController,
  obtenerComprobanteDetalleController,
  previsualizarImportacionComprasController,
  vincularDocumentoController,
} from './cfdi-sat-comprobantes.controller';
import { listarBitacoraController } from './cfdi-sat-bitacora.controller';
import { obtenerAlmacenamientoController, obtenerResumenModuloController } from './cfdi-sat-resumen.controller';
import {
  actualizarAutomatizacionController,
  ejecutarAutomatizacionController,
  obtenerAutomatizacionController,
} from './cfdi-sat-automatizacion.controller';

const router = Router();

router.use(requireAuth, requireEmpresaActiva);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 512 * 1024 },
});

const manejarUploadCredenciales = (req: Request, res: Response, next: NextFunction) => {
  const handler = upload.fields([
    { name: 'cer', maxCount: 1 },
    { name: 'key', maxCount: 1 },
  ]);

  handler(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Los archivos .cer/.key no deben exceder 512KB' });
      }
      return res.status(400).json({ message: err.message });
    }

    if (err) {
      return next(err);
    }

    return next();
  });
};

router.get('/credenciales', obtenerCredencialesController);
router.post('/credenciales', manejarUploadCredenciales, subirCredencialesController);
router.delete('/credenciales', eliminarCredencialesController);

router.get('/autorizacion', obtenerAutorizacionController);
router.post('/autorizacion', aceptarAutorizacionController);

router.get('/solicitudes', listarSolicitudesController);
router.post('/solicitudes', crearSolicitudController);
router.post('/solicitudes/:id/verificar', verificarSolicitudController);
router.post('/solicitudes/:id/descargar', descargarSolicitudController);
router.get('/solicitudes/:id/paquetes', listarPaquetesDeSolicitudController);

router.get('/comprobantes', listarComprobantesController);
router.post('/comprobantes/importar-compras-lote', importarComprobantesLoteController);
router.get('/comprobantes/:id/xml', descargarXmlComprobanteController);
router.get('/comprobantes/:id/importar-compras', previsualizarImportacionComprasController);
router.post('/comprobantes/:id/importar-compras', importarComprobanteComprasController);
router.get('/comprobantes/:id/candidatos-vinculacion', listarCandidatosVinculacionController);
router.post('/comprobantes/:id/vincular-documento', vincularDocumentoController);
router.get('/comprobantes/:id', obtenerComprobanteDetalleController);

router.get('/bitacora', listarBitacoraController);
router.get('/resumen', obtenerResumenModuloController);
router.get('/almacenamiento', obtenerAlmacenamientoController);

router.get('/automatizacion', obtenerAutomatizacionController);
router.put('/automatizacion', actualizarAutomatizacionController);
router.post('/automatizacion/ejecutar', ejecutarAutomatizacionController);

export default router;
