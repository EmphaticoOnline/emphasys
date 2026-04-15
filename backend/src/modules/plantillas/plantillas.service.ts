import { obtenerPlantillaActiva, type PlantillaDocumento } from './plantillas.repository';

type DocumentoPlantillaInput = {
  empresa_id?: string | number | null;
  tipo_documento?: string | null;
};

export async function obtenerPlantillaParaDocumento(
  documento: DocumentoPlantillaInput | null | undefined
): Promise<PlantillaDocumento | null> {
  const empresaId = documento?.empresa_id ?? null;
  const tipoDocumento = documento?.tipo_documento ?? null;

  console.log('SERVICE - buscando plantilla:', empresaId, tipoDocumento);

  if (!empresaId || !tipoDocumento) {
    return null;
  }

  return obtenerPlantillaActiva(empresaId, tipoDocumento);
}
