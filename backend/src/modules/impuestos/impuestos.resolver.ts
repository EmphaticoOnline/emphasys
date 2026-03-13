import type { PoolClient } from 'pg';
import type { ImpuestoCatalogo, TratamientoImpuestos } from './impuestos.types';
import {
  obtenerImpuestosDeProducto,
  obtenerImpuestosPorTratamiento,
  obtenerImpuestosDefaultEmpresa,
} from './impuestos.repository';

export class ImpuestosResolver {
  async resolverImpuestosAplicables(
    productoId: number | null,
    empresaId: number,
    tratamiento: TratamientoImpuestos,
    client?: PoolClient
  ): Promise<ImpuestoCatalogo[]> {
    const [impuestosProducto, impuestosTratamiento] = await Promise.all([
      productoId ? obtenerImpuestosDeProducto(productoId, client) : Promise.resolve([]),
      obtenerImpuestosPorTratamiento(tratamiento, client),
    ]);

    const impuestosDefaultEmpresa = impuestosProducto.length
      ? []
      : await obtenerImpuestosDefaultEmpresa(empresaId, client);

    console.log('[impuestos] empresa_id', empresaId);
    if (productoId) {
      console.log('[impuestos] producto_id', productoId);
    }
    console.log('[impuestos] tratamiento', tratamiento);
    console.log('[impuestos] producto impuestos', impuestosProducto);
    console.log('[impuestos] defaults empresa', impuestosDefaultEmpresa);
    console.log('[impuestos] reglas tratamiento', impuestosTratamiento);

    const baseImpuestos = impuestosProducto.length ? impuestosProducto : impuestosDefaultEmpresa;

    const mapaBase = new Map(baseImpuestos.map((imp) => [imp.id, imp]));
    const mapaTratamiento = new Map(impuestosTratamiento.map((imp) => [imp.id, imp]));

    // Jerarquía: 1) impuestos del producto, 2) default de la empresa, 3) reglas de tratamiento.
    // Si hay base (producto o empresa) y reglas de tratamiento, priorizamos la intersección;
    // si no existe intersección, aplicamos las reglas del tratamiento (permite overrides por tratamiento).
    if (mapaBase.size > 0 && mapaTratamiento.size > 0) {
      const intersection: ImpuestoCatalogo[] = [];
      for (const [id, imp] of mapaBase.entries()) {
        if (mapaTratamiento.has(id)) {
          intersection.push(imp);
        }
      }
      if (intersection.length > 0) {
        return intersection;
      }
      return Array.from(mapaTratamiento.values());
    }

    if (mapaTratamiento.size > 0) return Array.from(mapaTratamiento.values());
    return Array.from(mapaBase.values());
  }
}
