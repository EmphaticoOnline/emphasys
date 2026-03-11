import { obtenerCamposConfiguracion, type CampoConfiguracion } from '../campos-configuracion/campos-configuracion.repository';
import { obtenerCatalogosPorTipoFlexible, type CatalogoValorWithTipo } from '../catalogos/catalogos.repository';

export type DependenciaCampo = {
  padre_id: number;
  hijo_id: number;
};

export type CatalogoInicial = {
  campo_id: number;
  tipo_catalogo_id: number;
  opciones: CatalogoValorWithTipo[];
};

export type EsquemaCamposDocumento = {
  campos: CampoConfiguracion[];
  catalogos: CatalogoInicial[];
  dependencias: DependenciaCampo[];
};

export async function obtenerEsquemaCamposDocumentoRepository(
  empresaId: number,
  tipoDocumento?: string | null
): Promise<EsquemaCamposDocumento> {
  // 1) Campos de configuración para DOCUMENTO
  const campos = await obtenerCamposConfiguracion(empresaId, {
    entidad_tipo_codigo: 'DOCUMENTO',
    tipo_documento: tipoDocumento ?? undefined,
  });

  // 2) Dependencias padre-hijo
  const dependencias: DependenciaCampo[] = campos
    .filter((c) => c.campo_padre_id)
    .map((c) => ({ padre_id: c.campo_padre_id as number, hijo_id: c.id }));

  // 3) Catálogos iniciales: solo campos tipo lista sin padre (raíz) para evitar cargas innecesarias
  const catalogos: CatalogoInicial[] = [];
  const camposListaRaiz = campos.filter((c) => c.tipo_dato === 'lista' && c.catalogo_tipo_id && !c.campo_padre_id);

  for (const campo of camposListaRaiz) {
    const opciones = await obtenerCatalogosPorTipoFlexible(empresaId, campo.catalogo_tipo_id as number, null);
    catalogos.push({ campo_id: campo.id, tipo_catalogo_id: campo.catalogo_tipo_id as number, opciones });
  }

  return { campos, catalogos, dependencias };
}
