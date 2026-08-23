import { apiFetch } from './apiFetch';

export type CfdiPacModo = 'sandbox' | 'produccion';

export type CfdiPacConfig = {
  id: number;
  pac: string;
  modo: CfdiPacModo;
  base_url: string;
  username: string;
  password: string;
  stamp_path: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
  tiene_password: boolean;
};

export type CfdiPacConfigListResponse = {
  configuraciones: CfdiPacConfig[];
};

export type EmpresaCfdiPacAssignment = {
  empresa_id: number;
  empresa_nombre: string;
  cfdi_pac_config_id: number;
  pac: string;
  modo: CfdiPacModo;
  activo: boolean;
  csd_registrado: boolean;
  csd_fecha_actualizacion: string | null;
};

const BASE_URL = '/api/configuracion/cfdi-pac';

export async function fetchCfdiPacConfigs(): Promise<CfdiPacConfig[]> {
  const response = await apiFetch<CfdiPacConfigListResponse>(BASE_URL);
  return response.configuraciones ?? [];
}

export async function updateCfdiPacConfig(id: number, payload: Partial<CfdiPacConfig>) {
  return apiFetch<{ configuracion: CfdiPacConfig }>(`${BASE_URL}/${id}`, {
    method: 'PATCH',
    body: payload as any,
  });
}

export async function createCfdiPacConfig(payload: Partial<CfdiPacConfig>) {
  return apiFetch<{ configuracion: CfdiPacConfig }>(BASE_URL, {
    method: 'POST',
    body: payload as any,
  });
}

export async function fetchEmpresaCfdiPacAssignment(): Promise<EmpresaCfdiPacAssignment | null> {
  const response = await apiFetch<{ asignacion: EmpresaCfdiPacAssignment | null }>(`${BASE_URL}/asignacion`);
  return response.asignacion ?? null;
}

export async function updateEmpresaCfdiPacAssignment(cfdiPacConfigId: number): Promise<EmpresaCfdiPacAssignment> {
  const response = await apiFetch<{ asignacion: EmpresaCfdiPacAssignment }>(`${BASE_URL}/asignacion`, {
    method: 'PUT',
    body: { cfdiPacConfigId },
  });
  return response.asignacion;
}
