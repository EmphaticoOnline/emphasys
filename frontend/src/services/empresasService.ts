import { apiFetch } from './apiFetch';
import type { Empresa, EmpresaPayload } from '../types/empresa';

const BASE_URL = '/api/empresas';

export async function fetchEmpresas(): Promise<Empresa[]> {
  return apiFetch<Empresa[]>(BASE_URL);
}

export async function fetchEmpresa(id: number): Promise<Empresa> {
  return apiFetch<Empresa>(`${BASE_URL}/${id}`);
}

export async function createEmpresa(payload: EmpresaPayload): Promise<Empresa> {
  return apiFetch<Empresa>(BASE_URL, {
    method: 'POST',
    body: payload as any,
  });
}

export async function updateEmpresa(id: number, payload: EmpresaPayload): Promise<Empresa> {
  return apiFetch<Empresa>(`${BASE_URL}/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function deleteEmpresa(id: number): Promise<Empresa> {
  return apiFetch<Empresa>(`${BASE_URL}/${id}`, { method: 'DELETE' });
}
