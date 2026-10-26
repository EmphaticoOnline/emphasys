export type FuentesLogoEmpresa = {
  fetchAsset: (id: number, tipo: string) => Promise<{ ruta?: string | null } | null>;
};

/**
 * Ruta del logo empresarial (`logo_default`), o null para usar el de Emphasys.
 * Depende solo de que el asset exista: el modo de colores (Emphasys o personalizado)
 * y la presentación del logotipo no deciden qué logo se usa.
 */
export async function resolverLogoEmpresa(id: number, fuentes: FuentesLogoEmpresa): Promise<string | null> {
  const asset = await fuentes.fetchAsset(id, 'logo_default');
  return asset?.ruta || null;
}
