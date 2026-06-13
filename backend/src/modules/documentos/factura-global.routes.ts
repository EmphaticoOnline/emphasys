import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { generarFacturaGlobal, previewFacturaGlobal } from './factura-global.controller';

const router = Router();

// POST /api/factura-global/preview
// Retorna conteo y totales de ventas elegibles sin crear nada
router.post('/preview', requireAuth, requireEmpresaActiva, previewFacturaGlobal);

// POST /api/factura-global/generar
// Crea la factura global, ajustes y aplica saldos dentro de una transacción
router.post('/generar', requireAuth, requireEmpresaActiva, generarFacturaGlobal);

export default router;
