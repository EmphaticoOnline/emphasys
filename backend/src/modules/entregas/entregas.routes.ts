import { Router } from 'express';
import pool from '../../config/database';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';

const router = Router();
const estado = (value: unknown) => String(value || 'programada').toLowerCase() === 'entregada' ? 'entregada' : 'programada';

const select = `
  SELECT e.id, e.full_documento_id AS full_id, e.fecha, e.cantidad, e.estado AS estatus,
         e.contacto_id AS cliente_id, c.nombre AS cliente_nombre,
         e.fletera_contacto_id AS fletera_id, f.nombre AS fletera_nombre,
         e.carta_porte_referencia AS carta_porte, e.observaciones,
         e.domicilio_snapshot, e.datos_logisticos_snapshot,
         COALESCE(e.domicilio_snapshot->>'texto', e.domicilio_snapshot->>'domicilio', '') AS domicilio_envio,
         COALESCE(e.datos_logisticos_snapshot->>'operador_texto', '') AS operador,
         COALESCE(e.datos_logisticos_snapshot->>'numero_unidad', '') AS numero_unidad,
         COALESCE(SUM(CASE WHEN $2::int IS NULL OR ep.documento_id=$2 THEN ep.cantidad ELSE 0 END), 0) AS litros_facturados,
         COALESCE(SUM(ep.cantidad), 0) AS cantidad_vinculada
    FROM public.operaciones_entregas e
    LEFT JOIN public.contactos c ON c.id = e.contacto_id
    LEFT JOIN public.contactos f ON f.id = e.fletera_contacto_id
    LEFT JOIN public.operaciones_entregas_partidas ep ON ep.entrega_id = e.id
   WHERE e.empresa_id = $1`;

router.get('/', requireAuth, requireEmpresaActiva, async (req, res) => {
  try {
    const empresa = Number(req.context?.empresaId);
    const factura = req.query.factura_id ? Number(req.query.factura_id) : null;
    const full = req.query.full_id ? Number(req.query.full_id) : null;
    if (!factura && !full) return res.status(400).json({ error: 'Se requiere factura_id o full_id' });
    let query = select;
    const params: any[] = [empresa, factura];
    if (factura) query += ' AND EXISTS (SELECT 1 FROM public.operaciones_entregas_partidas x WHERE x.entrega_id=e.id AND x.documento_id=$2)';
    else { params[1] = null; params.push(full); query += ' AND e.full_documento_id=$3'; }
    query += ' GROUP BY e.id,e.full_documento_id,e.fecha,e.cantidad,e.estado,e.contacto_id,c.nombre,e.fletera_contacto_id,f.nombre,e.carta_porte_referencia,e.observaciones,e.domicilio_snapshot,e.datos_logisticos_snapshot ORDER BY e.fecha,e.id';
    const rows = await pool.query(query, params);
    return res.json(rows.rows);
  } catch (error) { console.error('[entregas] listar', error); return res.status(500).json({ error: 'Error al listar entregas' }); }
});

router.get('/litros-pendientes/:facturaId', requireAuth, requireEmpresaActiva, async (req, res) => {
  try {
    const empresa = Number(req.context?.empresaId);
    const facturaId = Number(req.params.facturaId);
    if (!Number.isInteger(facturaId) || facturaId <= 0) return res.status(400).json({ error: 'Factura inválida' });
    const result = await pool.query(`
      SELECT
        dp.cantidad AS litros_factura,
        COALESCE(SUM(epp.cantidad), 0) AS litros_entregados,
        GREATEST(dp.cantidad - COALESCE(SUM(epp.cantidad), 0), 0) AS litros_pendientes
      FROM public.documentos d
      JOIN public.documentos_partidas dp ON dp.documento_id = d.id
      LEFT JOIN public.operaciones_entregas_partidas epp
        ON epp.documento_id = dp.documento_id
       AND epp.partida_id = dp.id
      WHERE d.id = $1
        AND d.empresa_id = $2
        AND LOWER(d.tipo_documento) = 'factura'
      GROUP BY dp.id, dp.cantidad
      ORDER BY dp.id
      LIMIT 1`, [facturaId, empresa]);
    if (!result.rowCount) return res.status(404).json({ error: 'Factura o partida no encontrada' });
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[entregas] litros pendientes factura', error);
    return res.status(500).json({ error: 'Error al calcular litros pendientes' });
  }
});

router.post('/', requireAuth, requireEmpresaActiva, async (req: any, res) => {
  const client = await pool.connect();
  try {
    const b = req.body || {}, empresa = Number(req.context.empresaId), full = b.full_id ? Number(b.full_id) : null;
    const factura = b.factura_id ? Number(b.factura_id) : null;
    const cantidad = Number(b.cantidad);
    if (!b.fecha || !Number.isFinite(cantidad) || cantidad <= 0 || (!full && !factura)) return res.status(400).json({ error: 'fecha, cantidad y documento son obligatorios' });
    await client.query('BEGIN');
    let partida: any;
    if (factura) partida = (await client.query(`SELECT d.id documento_id,p.id partida_id FROM public.documentos d JOIN public.documentos_partidas p ON p.documento_id=d.id WHERE d.id=$1 AND d.empresa_id=$2 ORDER BY p.numero_partida LIMIT 1`, [factura, empresa])).rows[0];
    else partida = (await client.query(`SELECT d.id documento_id,p.id partida_id FROM public.documentos d JOIN public.documentos_partidas p ON p.documento_id=d.id WHERE d.id=$1 AND d.empresa_id=$2 ORDER BY p.numero_partida LIMIT 1`, [full, empresa])).rows[0];
    if (!partida) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Documento o partida no encontrada' }); }
    const inserted = await client.query(`INSERT INTO public.operaciones_entregas (empresa_id,fecha,cantidad,estado,full_documento_id,contacto_id,fletera_contacto_id,domicilio_snapshot,carta_porte_referencia,observaciones,datos_logisticos_snapshot,usuario_creacion_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [empresa,b.fecha,cantidad,estado(b.estatus),full,b.contacto_id||null,b.fletera_id||null,b.domicilio_envio ? {texto:b.domicilio_envio} : {},b.carta_porte||null,b.observaciones||null,{operador_texto:b.operador||null,numero_unidad:b.numero_unidad||null},req.auth.userId]);
    await client.query(`INSERT INTO public.operaciones_entregas_partidas (entrega_id,documento_id,partida_id,cantidad) VALUES ($1,$2,$3,$4)`, [inserted.rows[0].id,partida.documento_id,partida.partida_id,cantidad]);
    await client.query('COMMIT'); return res.status(201).json({...inserted.rows[0], factura_id: factura});
  } catch (e) { await client.query('ROLLBACK'); return res.status(500).json({ error: 'Error al crear entrega' }); } finally { client.release(); }
});

router.put('/:id', requireAuth, requireEmpresaActiva, async (req: any, res) => {
  try {
    const b=req.body||{}, id=Number(req.params.id), empresa=Number(req.context?.empresaId), cantidad=Number(b.cantidad);
    if (!Number.isFinite(cantidad) || cantidad<=0) return res.status(400).json({error:'cantidad inválida'});
    if (estado(b.estatus)==='entregada') { /* estado permitido; sólo afecta eliminación */ }
    const r=await pool.query(`UPDATE public.operaciones_entregas SET fecha=COALESCE($1,fecha),cantidad=$2,estado=$3,contacto_id=$4,fletera_contacto_id=$5,carta_porte_referencia=$6,observaciones=$7,domicilio_snapshot=CASE WHEN $8::text IS NULL THEN domicilio_snapshot ELSE jsonb_build_object('texto',$8) END,datos_logisticos_snapshot=jsonb_build_object('operador_texto',$9,'numero_unidad',$10) WHERE id=$11 AND empresa_id=$12 RETURNING *`,[b.fecha,cantidad,estado(b.estatus),b.contacto_id||null,b.fletera_id||null,b.carta_porte||null,b.observaciones||null,b.domicilio_envio||null,b.operador||null,b.numero_unidad||null,id,empresa]);
    if (!r.rowCount) return res.status(404).json({error:'Entrega no encontrada o no editable'});
    await pool.query(`UPDATE public.operaciones_entregas_partidas SET cantidad=$1 WHERE entrega_id=$2`,[cantidad,id]);
    return res.json({...r.rows[0],factura_id:b.factura_id||null});
  } catch { return res.status(500).json({error:'Error al actualizar entrega'}); }
});

router.delete('/:id', requireAuth, requireEmpresaActiva, async (req, res) => {
  try { const r=await pool.query(`DELETE FROM public.operaciones_entregas WHERE id=$1 AND empresa_id=$2 AND estado='programada' RETURNING id`,[Number(req.params.id),Number(req.context?.empresaId)]); if(!r.rowCount) return res.status(409).json({error:'Sólo se pueden eliminar entregas programadas'}); return res.json({ok:true}); }
  catch { return res.status(500).json({error:'Error al eliminar entrega'}); }
});

export default router;
