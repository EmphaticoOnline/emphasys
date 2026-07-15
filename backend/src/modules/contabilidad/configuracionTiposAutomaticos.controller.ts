import { Request, Response } from 'express';
import {
  listarConfiguracionTiposAutomaticos,
  actualizarConfiguracionTiposAutomaticos,
  ActualizarTipoAutomaticoInput,
} from './configuracionTiposAutomaticos.repository';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

export async function getConfiguracionTiposAutomaticos(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const items = await listarConfiguracionTiposAutomaticos(empresaId);
    return res.json(items);
  } catch (error) {
    console.error('Error al obtener configuración de tipos automáticos', error);
    return res.status(500).json({ message: 'No se pudo obtener la configuración de tipos automáticos' });
  }
}

export async function putConfiguracionTiposAutomaticos(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const itemsBody = Array.isArray(req.body?.items) ? req.body.items : [];
    const items: ActualizarTipoAutomaticoInput[] = itemsBody.map((item: any) => ({
      clave_movimiento: String(item?.clave_movimiento ?? ''),
      tipo_poliza_id:
        item?.tipo_poliza_id === null || item?.tipo_poliza_id === '' || item?.tipo_poliza_id === undefined
          ? null
          : Number(item.tipo_poliza_id),
    }));

    const actualizados = await actualizarConfiguracionTiposAutomaticos(empresaId, items);
    return res.json(actualizados);
  } catch (error) {
    console.error('Error al actualizar configuración de tipos automáticos', error);
    const message = (error as Error)?.message ?? 'No se pudo actualizar la configuración de tipos automáticos';
    if (message.startsWith('VALIDATION_ERROR:')) {
      return res.status(400).json({ message: message.replace('VALIDATION_ERROR:', '').trim() });
    }
    return res.status(500).json({ message: 'No se pudo actualizar la configuración de tipos automáticos' });
  }
}
