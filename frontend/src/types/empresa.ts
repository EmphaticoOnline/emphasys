export interface Empresa {
  id: number;
  identificador: string;
  nombre: string;
  razon_social: string;
  rfc: string;
  regimen_fiscal_id: string;
  codigo_postal_id: string;
  estado_id: string;
  localidad_id?: string | null;
  colonia_id?: string | null;
  calle?: string | null;
  numero_exterior?: string | null;
  numero_interior?: string | null;
  pais?: string | null;
  telefono?: string | null;
  email?: string | null;
  sitio_web?: string | null;
  certificado_csd?: string | null;
  llave_privada_csd?: string | null;
  password_csd?: string | null;
  codigo_postal?: string | null;
  regimen_fiscal?: string | null;
  activo: boolean;
  created_at?: string;
}

export type EmpresaPayload = Partial<Empresa>;
