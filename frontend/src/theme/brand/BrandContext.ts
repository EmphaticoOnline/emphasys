import { createContext, useContext } from 'react';
import { activeBrand } from './active.ts';
import type { BrandDefinition } from './types.ts';

/**
 * Marca que aplican los temas. Sin proveedor vale la marca activa del build,
 * así que la app se ve igual mientras nadie la cambie.
 */
export const BrandContext = createContext<BrandDefinition>(activeBrand);

export function useActiveBrand(): BrandDefinition {
  return useContext(BrandContext);
}
