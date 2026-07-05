import { Request, Response } from 'express';
import { obtenerDocumentoRepository, obtenerDocumentosRelacionadosRepository } from './documentos.repository';
import { listarPagosAplicadosPorDocumento, listarNotasCreditoAplicadasPorDocumento } from '../finanzas/finanzas.repository';
import { listarMovimientosPorDocumentoRepository } from '../inventario/inventario.repository';
import { evaluarScopeVentas, resolverContextoScopeComercial } from '../auth/scope-comercial';
import type { TipoDocumento } from '../../types/documentos';

export async function obtenerDetalleDocumentoHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(id) || !empresaId) return res.status(400).json({ message: 'ID o empresaId inválido' });

    const scope = evaluarScopeVentas(
      await resolverContextoScopeComercial(Number(empresaId), req.auth?.userId, req.auth?.esSuperadmin)
    );
    if (scope.sinAcceso) {
      return res.status(403).json({ message: 'Su usuario no tiene un vendedor asociado; no puede consultar documentos.' });
    }

    const tipoQuery = req.query.tipo_documento;
    const tipo = (tipoQuery ? String(tipoQuery).toLowerCase() : 'cotizacion') as TipoDocumento;

    const result = await obtenerDocumentoRepository(id, Number(empresaId), tipo, scope.agenteId);
    if (!result) return res.status(404).json({ message: 'Documento no encontrado' });

    const [pagos, notasCredito, movimientosInventario, documentosRelacionados] = await Promise.all([
      listarPagosAplicadosPorDocumento(id, Number(empresaId)),
      listarNotasCreditoAplicadasPorDocumento(id, Number(empresaId)),
      listarMovimientosPorDocumentoRepository(id, Number(empresaId)),
      obtenerDocumentosRelacionadosRepository(id, Number(empresaId)),
    ]);

    res.json({
      documento: result.documento,
      partidas: result.partidas,
      pagos,
      notasCredito,
      documentosRelacionados,
      movimientosInventario,
    });
  } catch (error) {
    console.error('Error al obtener detalle de documento', error);
    res.status(500).json({ message: 'Error al obtener detalle de documento' });
  }
}
