import type { Request, Response } from 'express';
import {
  listarBitacora,
  type CfdiSatBitacoraAccion,
  type CfdiSatBitacoraResultado,
  type ListarBitacoraFiltros,
} from './cfdi-sat-bitacora.repository';
import { getEmpresaId } from './cfdi-sat.shared';

const ACCIONES_VALIDAS: CfdiSatBitacoraAccion[] = [
  'credencial_subida',
  'credencial_eliminada',
  'autorizacion_aceptada',
  'solicitud_creada',
  'verificacion',
  'descarga_paquete',
  'importado_compras',
  'verificacion_automatica',
  'descarga_automatica',
  'automatizacion_error',
  'vinculacion_documento',
  'error',
];
const RESULTADOS_VALIDOS: CfdiSatBitacoraResultado[] = ['ok', 'error'];
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseStringParam(value: unknown): string | undefined {
  const texto = typeof value === 'string' ? value.trim() : '';
  return texto ? texto : undefined;
}

function parseIntParam(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function parseFiltros(query: Request['query']): ListarBitacoraFiltros {
  const filtros: ListarBitacoraFiltros = {};

  const fechaInicio = parseStringParam(query.fecha_inicio);
  if (fechaInicio && FECHA_REGEX.test(fechaInicio)) filtros.fechaInicio = fechaInicio;

  const fechaFin = parseStringParam(query.fecha_fin);
  if (fechaFin && FECHA_REGEX.test(fechaFin)) filtros.fechaFin = fechaFin;

  const accion = parseStringParam(query.accion);
  if (accion && ACCIONES_VALIDAS.includes(accion as CfdiSatBitacoraAccion)) {
    filtros.accion = accion as CfdiSatBitacoraAccion;
  }

  const resultado = parseStringParam(query.resultado);
  if (resultado && RESULTADOS_VALIDOS.includes(resultado as CfdiSatBitacoraResultado)) {
    filtros.resultado = resultado as CfdiSatBitacoraResultado;
  }

  filtros.usuarioId = parseIntParam(query.usuario_id);
  filtros.solicitudId = parseIntParam(query.solicitud_id);
  filtros.comprobanteId = parseIntParam(query.comprobante_id);
  filtros.uuid = parseStringParam(query.uuid);
  filtros.page = parseIntParam(query.page) ?? 1;
  filtros.pageSize = parseIntParam(query.pageSize) ?? 25;

  return filtros;
}

/**
 * Lista la bitácora del módulo CFDI SAT. `detalle` ya está saneado desde que se
 * escribe (ver registrarBitacora): nunca contiene contraseñas, contenido de
 * certificados, XML crudo ni rutas físicas — solo ids y mensajes descriptivos.
 */
export async function listarBitacoraController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const filtros = parseFiltros(req.query);
    const resultado = await listarBitacora(empresaId, filtros);

    return res.json({
      bitacora: resultado.rows,
      total: resultado.total,
      page: resultado.page,
      pageSize: resultado.pageSize,
    });
  } catch (error) {
    console.error('[CFDI SAT] Error al listar bitácora', error);
    return res.status(500).json({ message: 'No se pudo obtener la bitácora' });
  }
}
