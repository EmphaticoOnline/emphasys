export type TratamientoImpuestos = 'normal' | 'sin_iva' | 'tasa_cero' | 'exento' | string;

export type ImpuestoCatalogo = {
  id: string;
  nombre: string;
  tipo: 'traslado' | 'retencion' | string;
  tasa: number;
};

export type ImpuestoCalculado = {
  impuestoId: string;
  base: number;
  monto: number;
  tasa: number;
  tipo: 'traslado' | 'retencion' | string;
};

export type PartidaConDocumento = {
  partidaId: number;
  documentoId: number;
  productoId: number | null;
  empresaId: number;
  subtotalPartida: number;
  tratamientoImpuestos: TratamientoImpuestos;
  estatusDocumento: string;
  tipoDocumento: string;
};
