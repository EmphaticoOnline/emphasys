export interface Contacto {
  id: number;
  empresa_id: number;
  tipo_contacto: string;
  clasificacion?: string | null;
  clasificacion_descripcion?: string | null;
  origen_contacto?: string | null;
  origen_contacto_descripcion?: string | null;
  precio_lista_id?: number | null;
  precio_lista_nombre?: string | null;
  nombre: string;
  nombre_contacto?: string | null;
  interes_inicial?: string | null;
  rfc?: string | null;
  email?: string | null;
  telefono?: string | null;
  telefono_secundario?: string | null;
  activo: boolean;
  bloqueado: boolean;
  dias_credito?: number | null;
  limite_credito?: number | null;
  vendedor_id?: number | null;
  fecha_alta: string;
  updated_at: string;
  observaciones?: string | null;
  motivo_bloqueo?: string | null;
  zona?: string | null;
  ultimo_concepto_utilizado?: string | null;
  iva_desglosado?: boolean | null;
}

export interface ContactoDomicilioPrincipal {
  calle?: string | null;
  numero_exterior?: string | null;
  numero_interior?: string | null;
  colonia?: string | null;
  ciudad?: string | null;
  estado?: string | null;
  cp?: string | null;
  pais?: string | null;
  cp_sat?: string | null;
  colonia_sat?: string | null;
}

export interface ContactoDomicilio {
  id: number;
  contacto_id: number;
  identificador: string;
  es_principal: boolean;
  responsable?: string | null;
  domicilio?: string | null;
  calle?: string | null;
  numero_exterior?: string | null;
  numero_interior?: string | null;
  colonia?: string | null;
  ciudad?: string | null;
  estado?: string | null;
  cp?: string | null;
  pais?: string | null;
  cruces?: string | null;
  recibe?: string | null;
  telefono_recibe?: string | null;
  coto_o_fraccionamiento?: string | null;
  telefono?: string | null;
  fax?: string | null;
  observaciones?: string | null;
  cp_sat?: string | null;
  colonia_sat?: string | null;
  tipo_referencia?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  activo: boolean;
}

export interface ContactoDatosFiscales {
  rfc?: string | null;
  regimen_fiscal?: string | null;
  uso_cfdi?: string | null;
  forma_pago?: string | null;
  metodo_pago?: string | null;
  codigo_postal?: string | null;
}

export interface ContactoDetalle {
  contacto: Contacto;
  domicilio_principal?: ContactoDomicilioPrincipal | null;
  datos_fiscales?: ContactoDatosFiscales | null;
}

export interface ContactoTelefonoMatch {
  contacto_id: number;
  nombre: string;
  tipo_contacto: string;
  input_field: 'telefono' | 'telefono_secundario';
  matched_field: 'telefono' | 'telefono_secundario';
  normalized_phone: string;
}
