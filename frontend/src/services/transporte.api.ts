import { apiFetch } from './apiFetch';

export type ViajeFactura = { viaje_id: number; estatus: string; folio_interno?: string; documento_id: number; carta_porte?: Record<string, unknown> | null };
export const obtenerViajePorDocumento = (documentoId: number) => apiFetch<ViajeFactura | null>(`/api/transporte/documentos/${documentoId}/viaje`);
export const crearViajeDesdeDocumento = (documentoId: number) => apiFetch<ViajeFactura>(`/api/transporte/documentos/${documentoId}/viaje`, { method: 'POST' });
export const obtenerViaje = (viajeId: number) => apiFetch<ViajeFactura>(`/api/transporte/viajes/${viajeId}`);

export type UbicacionDisponible = { domicilio_id:number; tipo_propietario:'contacto'|'empresa'; contacto_id:number|null; empresa_id:number|null; propietario_nombre:string; identificador:string; es_principal:boolean; tipo_referencia:string|null; calle:string|null; numero_exterior:string|null; numero_interior:string|null; colonia:string|null; ciudad:string|null; estado:string|null; codigo_postal:string|null; pais:string|null; cp_sat:string|null; colonia_sat:string|null; latitud:number|null; longitud:number|null; activo:boolean };
export const obtenerUbicacionesDisponibles = (params = '') => apiFetch<UbicacionDisponible[]>(`/api/transporte/ubicaciones-disponibles${params ? `?${params}` : ''}`);

export type OperadorDisponible = { operador_id:number; contacto_id:number; nombre:string; rfc:string|null; curp:string|null; numero_licencia:string; tipo_licencia:string|null; vigencia_licencia:string|null };
export const obtenerOperadoresDisponibles = () => apiFetch<OperadorDisponible[]>('/api/transporte/operadores-disponibles');

export type VehiculoTransporte = { id:number; clave_interna:string; placas:string; configuracion_vehicular_sat:string|null; peso_bruto_vehicular:number|null; modelo_anio:number|null; activo:boolean; remolque_predeterminado_id:number|null; remolque_predeterminado_clave:string|null; remolque_predeterminado_placas:string|null; remolque_predeterminado_subtipo:string|null };
export const obtenerVehiculos = () => apiFetch<VehiculoTransporte[]>('/api/transporte/vehiculos?activo=activos');

export type RemolqueTransporte = { id:number; clave_interna:string; placas:string; subtipo_remolque_sat:string|null; subtipo_descripcion:string|null; activo:boolean };
export const obtenerRemolques = () => apiFetch<RemolqueTransporte[]>('/api/transporte/remolques?activo=activos');

// Agregado completo del Viaje (GET /viajes/:id)
export type ViajeUbicacion = {
  id:number;
  domicilio_id:number|null;
  domicilio_contacto_id:number|null;
  domicilio_empresa_id:number|null;
  domicilio_identificador:string|null;
  domicilio_tipo_propietario:'contacto'|'empresa'|null;
  domicilio_propietario_nombre:string|null;
  tipo:'origen'|'destino';
  secuencia:number;
  fecha_hora_programada:string|null;
  fecha_hora_real:string|null;
  distancia_recorrida:number|null;
  domicilio_snapshot:Record<string, unknown>|null;
};
export type ViajeRemolque = { id:number; remolque_id:number; orden:number; datos_snapshot:Record<string, unknown>|null };
export type ViajeFigura = { id:number; tipo_figura:string; operador_id:number|null; contacto_id:number|null; secuencia:number; datos_snapshot:Record<string, unknown>|null };
export type ViajeMercancia = {
  id:number;
  producto_id:number|null;
  descripcion_snapshot:string;
  clave_bienes_transportados_sat:string|null;
  clave_unidad_sat:string|null;
  unidad_descripcion:string|null;
  cantidad:string|number;
  peso_kg:string|number;
  valor_mercancia:string|number|null;
  material_peligroso:boolean;
  clave_material_peligroso:string|null;
  embalaje:string|null;
  descripcion_embalaje:string|null;
  origen_secuencia:number|null;
  destino_secuencia:number|null;
};
export type ViajeAggregate = {
  viaje: { id:number; folio_interno:string; cliente_contacto_id:number; estatus:string; fecha_programada:string|null; fecha_inicio:string|null; fecha_fin:string|null; vehiculo_id:number|null; referencia_cliente:string|null; observaciones:string|null };
  ubicaciones: ViajeUbicacion[];
  mercancias: ViajeMercancia[];
  figuras: ViajeFigura[];
  remolques: ViajeRemolque[];
  documentos: Array<Record<string, unknown>>;
  cartaPorte: { id:number; estatus:string } | null;
};
export const obtenerViajeAggregate = (viajeId: number) => apiFetch<ViajeAggregate>(`/api/transporte/viajes/${viajeId}`);

// Partidas de la factura disponibles para importarse como mercancías del Viaje.
export type PartidaImportable = {
  partida_id:number;
  numero_partida:number;
  producto_id:number|null;
  descripcion:string|null;
  cantidad:string|number|null;
  unidad_partida:string|null;
  unidad_descripcion:string|null;
  clave_unidad_sat:string|null;
  clave_bienes_transportados_sat:string|null;
  material_peligroso:boolean;
  clave_material_peligroso:string|null;
  embalaje:string|null;
  descripcion_embalaje:string|null;
  valor_mercancia:string|number|null;
  peso_sugerido:string|number|null;
};
export const obtenerPartidasImportables = (documentoId: number) =>
  apiFetch<PartidaImportable[]>(`/api/transporte/documentos/${documentoId}/partidas-importables`);

export type ViajeMercanciaInput = {
  productoId:number|null;
  descripcion:string|null;
  cantidad:number;
  pesoKg:number;
  valorMercancia:number|null;
  claveBienesTransportadosSat:string|null;
  claveUnidadSat:string|null;
  unidadDescripcion:string|null;
  materialPeligroso:boolean;
  claveMaterialPeligroso:string|null;
  embalaje:string|null;
  descripcionEmbalaje:string|null;
  origenSecuencia:number|null;
  destinoSecuencia:number|null;
};

export type ViajeUbicacionInput = { domicilioId:number; tipo:'origen'|'destino'; secuencia:number; fechaHoraProgramada:string; distanciaRecorrida?:number|null };
export type ViajePutPayload = {
  folioInterno:string;
  clienteContactoId:number;
  estatus:'borrador';
  vehiculoId:number|null;
  ubicaciones:ViajeUbicacionInput[];
  /**
   * Si se omite, el backend preserva intactas las mercancías existentes.
   * El drawer ahora SÍ la envía (bloque Mercancías editable); `[]` la vacía.
   */
  mercancias?:ViajeMercanciaInput[];
  figuras:Array<{ tipoFigura:'operador'; operadorId:number; secuencia:number }>;
  remolques:Array<{ remolqueId:number; orden:number }>;
};
export const actualizarViaje = (viajeId: number, payload: ViajePutPayload) =>
  apiFetch<ViajeAggregate>(`/api/transporte/viajes/${viajeId}`, { method: 'PUT', body: payload });

// Validación de Carta Porte (materialización previa al timbrado — NO timbra).
export type CartaPorteIssueSection = 'ruta' | 'unidad' | 'operador' | 'mercancias' | 'generales';
export type CartaPorteIssue = { section: CartaPorteIssueSection; message: string; index?: number };
export type ValidarCartaPorteOk = { estado: string; cartaPorte31: Record<string, unknown>; materializacion: Record<string, unknown> };
/** 422 con `{ code:'CARTA_PORTE_VALIDATION', message, issues: CartaPorteIssue[] }` cuando faltan datos. */
export const validarCartaPorte = (viajeId: number) =>
  apiFetch<ValidarCartaPorteOk>(`/api/transporte/viajes/${viajeId}/validar-carta-porte`, { method: 'POST' });
