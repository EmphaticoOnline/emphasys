import type { Request, Response } from 'express';
import { obtenerNombresVendedores } from './metricas.repository';
import { calcularMetricasVendedores } from './metricas.service';

const fecha = (v: unknown) => { if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false; const d = new Date(`${v}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; };
const error = (res: Response, message: string) => res.status(400).json({ message });

export async function getMetricas(req: Request, res: Response) {
  const empresaId = req.context?.empresaId; const desde = req.query.desde as string | undefined; const hasta = req.query.hasta as string | undefined;
  if (!empresaId) return error(res, 'Empresa activa no disponible'); if ((desde && !fecha(desde)) || (hasta && !fecha(hasta))) return error(res, 'Fecha inválida; use YYYY-MM-DD'); if (desde && hasta && desde > hasta) return error(res, 'El rango de fechas es inválido');
  const corte = '2026-09-15T21:55:41.716Z'; const desdeEfectiva = desde && desde < corte.slice(0, 10) ? corte.slice(0, 10) : desde;
  try { const result = await calcularMetricasVendedores(corte, empresaId, { desde: desdeEfectiva, hasta }); const nombres = await obtenerNombresVendedores(empresaId, result.resumen_por_vendedor.map((x) => x.vendedor_contacto_id)); return res.json({ periodo: { desde: desdeEfectiva ?? corte.slice(0, 10), hasta: hasta ?? new Date().toISOString().slice(0, 10), corte_confiable: corte }, vendedores: result.resumen_por_vendedor.map((x) => ({ ...x, nombre: nombres.get(x.vendedor_contacto_id) ?? null })) }); } catch (e) { console.error('Error calculando métricas:', e); return res.status(500).json({ message: 'No se pudieron obtener las métricas' }); }
}

export async function getBloques(req: Request, res: Response) {
  const empresaId = req.context?.empresaId; const desde = req.query.desde as string | undefined; const hasta = req.query.hasta as string | undefined; const estado = req.query.estado as string | undefined; const vendedor = req.query.vendedor_contacto_id as string | undefined;
  if (!empresaId) return error(res, 'Empresa activa no disponible'); if ((desde && !fecha(desde)) || (hasta && !fecha(hasta))) return error(res, 'Fecha inválida; use YYYY-MM-DD'); if (desde && hasta && desde > hasta) return error(res, 'El rango de fechas es inválido'); if (estado && !['respondido', 'pendiente'].includes(estado)) return error(res, 'Estado inválido'); if (vendedor && (!/^\d+$/.test(vendedor) || Number(vendedor) <= 0)) return error(res, 'vendedor_contacto_id inválido');
  const corte = '2026-09-15T21:55:41.716Z'; const desdeEfectiva = desde && desde < corte.slice(0, 10) ? corte.slice(0, 10) : desde;
  try { const result = await calcularMetricasVendedores(corte, empresaId, { desde: desdeEfectiva, hasta }); let respondidos = result.bloques_respondidos; let pendientes = result.bloques_pendientes; if (vendedor) { const id = Number(vendedor); respondidos = respondidos.filter((x) => x.autor_respuesta_vendedor_contacto_id === id); pendientes = pendientes.filter((x) => x.responsable_vigente_contacto_id === id); } return res.json({ periodo: { desde: desdeEfectiva ?? corte.slice(0, 10), hasta: hasta ?? new Date().toISOString().slice(0, 10), corte_confiable: corte }, bloques_respondidos: estado === 'pendiente' ? [] : respondidos, bloques_pendientes: estado === 'respondido' ? [] : pendientes }); } catch (e) { console.error('Error obteniendo bloques:', e); return res.status(500).json({ message: 'No se pudieron obtener los bloques' }); }
}
