import { Router } from 'express';
import { requireAuth, requireEmpresaActiva, requireAdministradorInventario } from '../auth/auth.middleware';
import {
  postMovimientoManual,
  postAplicarDocumento,
  postRevertirDocumento,
  getMovimientos,
  getPeriodosMovimientos,
  getMovimientoDetalle,
  exportarMovimientos,
  postAfectarMovimiento,
  postDesafectarMovimiento,
  putEditarMovimientoManual,
  deleteMovimientoManual,
} from './inventario.controller';
import { postAnalizarRecalculo, postEjecutarRecalculo } from './recalculo.controller';

const router = Router();

router.use(requireAuth, requireEmpresaActiva);
router.post('/recalculos/analizar', requireAdministradorInventario, postAnalizarRecalculo);
router.post('/recalculos/ejecutar', requireAdministradorInventario, postEjecutarRecalculo);

router.post('/movimientos/exportar', exportarMovimientos);
router.post('/movimientos/manual', postMovimientoManual);
router.post('/movimientos/:id/afectar', postAfectarMovimiento);
router.post('/movimientos/:id/desafectar', postDesafectarMovimiento);
router.put('/movimientos/:id', putEditarMovimientoManual);
router.delete('/movimientos/:id', requireAdministradorInventario, deleteMovimientoManual);
router.post('/documentos/:id/aplicar', postAplicarDocumento);
router.post('/documentos/:id/revertir', postRevertirDocumento);
router.get('/movimientos/periodos', getPeriodosMovimientos);
router.get('/movimientos/:id', getMovimientoDetalle);
router.get('/movimientos', getMovimientos);
router.get('/productos/:productoId/ultimo-costo', async (req, res) => {
  const empresaId = Number((req as any).context?.empresaId);
  const productoId = Number(req.params.productoId);
  if (!empresaId || !productoId) return res.status(400).json({ message: 'productoId inválido' });
  try {
    const pool = (await import('../../config/database')).default;
    const { rows } = await pool.query(`SELECT mp.costo_unitario FROM inventario.movimientos_partidas mp JOIN inventario.movimientos m ON m.id=mp.movimiento_id WHERE mp.empresa_id=$1 AND mp.producto_id=$2 AND mp.signo=1 AND mp.tipo_partida='normal' AND mp.costo_unitario>0 ORDER BY m.fecha DESC,m.id DESC,mp.id DESC LIMIT 1`, [empresaId, productoId]);
    return res.json({ costo_unitario: rows[0]?.costo_unitario ?? null });
  } catch (e) { return res.status(500).json({ message: 'No se pudo obtener el último costo de adquisición' }); }
});

export default router;
