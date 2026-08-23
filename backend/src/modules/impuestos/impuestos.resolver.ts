import type { PoolClient } from 'pg';
import type { ImpuestoCatalogo, TratamientoImpuestos } from './impuestos.types';
import {
  obtenerImpuestosDeProducto,
  obtenerImpuestosPorTratamiento,
  obtenerImpuestosDefaultEmpresa,
} from './impuestos.repository';

export function resolverImpuestosPorJerarquia(
  impuestosProducto: ImpuestoCatalogo[],
  impuestosDefaultEmpresa: ImpuestoCatalogo[],
  impuestosTratamiento: ImpuestoCatalogo[],
  tratamiento: TratamientoImpuestos
): ImpuestoCatalogo[] {
  // En el tratamiento ordinario, la configuración explícita del producto es
  // autoritativa. Esto conserva tanto traslados como retenciones asociados.
  if (String(tratamiento).toLowerCase() === 'normal' && impuestosProducto.length > 0) {
    return impuestosProducto;
  }

  const baseImpuestos = impuestosProducto.length ? impuestosProducto : impuestosDefaultEmpresa;
  const mapaBase = new Map(baseImpuestos.map((imp) => [imp.id, imp]));
  const mapaTratamiento = new Map(impuestosTratamiento.map((imp) => [imp.id, imp]));

  // Para tratamientos fiscales especiales se conserva la lógica previa:
  // intersección con la base y, si no coincide, override del tratamiento.
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

    // Jerarquía: 1) impuestos del producto, 2) default de la empresa, 3) reglas de tratamiento.
    return resolverImpuestosPorJerarquia(
      impuestosProducto,
      impuestosDefaultEmpresa,
      impuestosTratamiento,
      tratamiento
    );
  }
}
