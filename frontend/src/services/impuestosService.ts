import { apiFetch } from './apiFetch';
import type { EmpresaImpuestoDefault, ImpuestoCatalogo } from '../types/impuestos';

const IMPUESTOS_BASE = '/api/impuestos';
const EMPRESA_IMPUESTOS_DEFAULT_BASE = '/api/empresas/impuestos-default';

export async function fetchImpuestosCatalogo(): Promise<ImpuestoCatalogo[]> {
  return apiFetch<ImpuestoCatalogo[]>(IMPUESTOS_BASE);
}

export async function fetchEmpresaImpuestosDefault(): Promise<EmpresaImpuestoDefault[]> {
  return apiFetch<EmpresaImpuestoDefault[]>(EMPRESA_IMPUESTOS_DEFAULT_BASE);
}

export async function crearEmpresaImpuestoDefault(payload: {
  impuesto_id: string;
  orden?: number | null;
}): Promise<EmpresaImpuestoDefault> {
  return apiFetch<EmpresaImpuestoDefault>(EMPRESA_IMPUESTOS_DEFAULT_BASE, {
    method: 'POST',
    body: payload as any,
  });
}

export async function actualizarEmpresaImpuestoDefault(
  id: number,
  payload: { orden?: number | null }
): Promise<EmpresaImpuestoDefault> {
  return apiFetch<EmpresaImpuestoDefault>(`${EMPRESA_IMPUESTOS_DEFAULT_BASE}/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function eliminarEmpresaImpuestoDefault(id: number): Promise<void> {
  await apiFetch<void>(`${EMPRESA_IMPUESTOS_DEFAULT_BASE}/${id}`, {
    method: 'DELETE',
  });
}
