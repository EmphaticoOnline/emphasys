import { Request, Response } from 'express';
import {
  guardarCamposDocumentoRepository,
  guardarCamposPartidaRepository,
  obtenerCamposDocumentoRepository,
  obtenerCamposPartidaRepository,
  ValorCampoPayload,
} from './documentos-campos.repository';

function parseValores(body: any): ValorCampoPayload[] {
  if (!Array.isArray(body?.valores)) return [];
  return body.valores
    .map((item: any) => ({
      campo_id: Number(item?.campo_id),
      catalogo_id: item?.catalogo_id === undefined ? null : Number(item.catalogo_id),
      valor_texto: item?.valor_texto ?? null,
      valor_numero: item?.valor_numero !== undefined ? Number(item.valor_numero) : item?.valor_numero,
      valor_fecha: item?.valor_fecha ?? null,
      valor_boolean: item?.valor_boolean ?? null,
    }))
  .filter((v: ValorCampoPayload) => Number.isFinite(v.campo_id));
}

export async function guardarCamposDocumento(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const documentoId = Number(req.body?.documento_id);
    console.log('payload documentos-campos:', req.body);
    if (!empresaId) return res.status(400).json({ message: 'empresaId es obligatorio' });
    if (!Number.isFinite(documentoId)) return res.status(400).json({ message: 'documento_id es obligatorio y numérico' });

    const valores = parseValores(req.body);
    await guardarCamposDocumentoRepository(Number(empresaId), documentoId, valores);
    res.status(201).json({ ok: true, count: valores.length });
  } catch (error) {
    console.error('Error al guardar campos dinámicos de documento', error);
    res.status(500).json({ message: 'Error al guardar campos dinámicos de documento' });
  }
}

export async function guardarCamposPartida(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const partidaId = Number(req.body?.partida_id);
    if (!empresaId) return res.status(400).json({ message: 'empresaId es obligatorio' });
    if (!Number.isFinite(partidaId)) return res.status(400).json({ message: 'partida_id es obligatorio y numérico' });

    const valores = parseValores(req.body);
    await guardarCamposPartidaRepository(Number(empresaId), partidaId, valores);
    res.status(201).json({ ok: true, count: valores.length });
  } catch (error) {
    console.error('Error al guardar campos dinámicos de partida', error);
    res.status(500).json({ message: 'Error al guardar campos dinámicos de partida' });
  }
}

export async function obtenerCamposDocumento(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const documentoId = Number(req.params?.documentoId ?? req.params?.id);

    if (!empresaId) return res.status(400).json({ message: 'empresaId es obligatorio' });
    if (!Number.isFinite(documentoId)) return res.status(400).json({ message: 'documentoId es obligatorio y numérico' });

    const valores = await obtenerCamposDocumentoRepository(Number(empresaId), documentoId);
    if (valores === null) return res.status(404).json({ message: 'Documento no encontrado en la empresa' });

    res.json({ valores });
  } catch (error) {
    console.error('Error al obtener campos dinámicos de documento', error);
    res.status(500).json({ message: 'Error al obtener campos dinámicos de documento' });
  }
}

export async function obtenerCamposPartida(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const partidaId = Number(req.params?.partidaId ?? req.params?.id);

    if (!empresaId) return res.status(400).json({ message: 'empresaId es obligatorio' });
    if (!Number.isFinite(partidaId)) return res.status(400).json({ message: 'partidaId es obligatorio y numérico' });

    const valores = await obtenerCamposPartidaRepository(Number(empresaId), partidaId);
    if (valores === null) return res.status(404).json({ message: 'Partida no encontrada en la empresa' });

    res.json({ valores });
  } catch (error) {
    console.error('Error al obtener campos dinámicos de partida', error);
    res.status(500).json({ message: 'Error al obtener campos dinámicos de partida' });
  }
}
