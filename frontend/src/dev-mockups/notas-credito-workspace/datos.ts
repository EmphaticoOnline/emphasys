import type { TratamientoImpuestos } from '../../types/cotizacion';

export type MotivoNc = 'devolucion' | 'bonificacion' | 'otro';
export type EstatusNota = 'borrador' | 'emitido' | 'timbrado' | 'cancelado';

export type FacturaOrigenMock = {
  id: number;
  serie: string;
  numero: number;
  fecha: string;
  estatus: string;
  total: number;
  cliente: string;
};

export type PartidaMock = {
  id: number;
  origenId: number | null;
  clave: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  importe: number;
};

export type AplicacionMock = {
  id: number;
  serie: string;
  numero: number;
  fecha: string;
  monto: number;
};

export type NotaCreditoMock = {
  id: number;
  serie: string;
  numero: number;
  fecha: string;
  cliente: string;
  contactoId: number;
  rfc: string;
  motivo: MotivoNc;
  concepto: string | null;
  observaciones: string | null;
  estatus: EstatusNota;
  tratamiento: TratamientoImpuestos;
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
  saldo: number;
  uuid: string | null;
  fechaTimbrado: string | null;
  estadoSat: string | null;
  cfdiPacId: string | null;
  cfdiPacModalidad: 'web' | 'lite' | null;
  cancelacionEstado: string | null;
  origenes: FacturaOrigenMock[];
  partidas: PartidaMock[];
  aplicaciones: AplicacionMock[];
  usoCfdi: string | null;
  formaPago: string | null;
  metodoPago: string | null;
  regimen: string | null;
  codigoPostal: string | null;
};

const fiscalKemper = {
  rfc: 'EKU9003173C9',
  usoCfdi: 'G03',
  formaPago: '03',
  metodoPago: 'PUE',
  regimen: '601',
  codigoPostal: '42501',
};

const fiscalBenigno = {
  rfc: 'MOBE800101ABC',
  usoCfdi: 'G03',
  formaPago: '03',
  metodoPago: 'PUE',
  regimen: '612',
  codigoPostal: '44100',
};

export const NOTAS: NotaCreditoMock[] = [
  {
    id: 1007,
    serie: 'NC',
    numero: 7,
    fecha: '2026-09-25',
    cliente: 'ESCUELA KEMPER URGATE',
    contactoId: 12,
    ...fiscalKemper,
    motivo: 'devolucion',
    concepto: null,
    observaciones: 'Devolución parcial de papel bond.',
    estatus: 'borrador',
    tratamiento: 'normal',
    subtotal: 1000,
    descuento: 0,
    iva: 160,
    total: 1160,
    saldo: 1160,
    uuid: null,
    fechaTimbrado: null,
    estadoSat: null,
    cfdiPacId: null,
    cfdiPacModalidad: null,
    cancelacionEstado: null,
    origenes: [
      { id: 7007, serie: 'A', numero: 7, fecha: '2026-09-25', estatus: 'Timbrado', total: 11600, cliente: 'ESCUELA KEMPER URGATE' },
    ],
    partidas: [
      { id: 1, origenId: 7007, clave: 'PAP-BOND', descripcion: 'Papel bond carta', cantidad: 10, precio: 100, importe: 1000 },
    ],
    aplicaciones: [],
  },
  {
    id: 1001,
    serie: 'NCR',
    numero: 1,
    fecha: '2026-09-26',
    cliente: 'Benigno Moya',
    contactoId: 4,
    rfc: 'MOBE800101ABC',
    motivo: 'devolucion',
    concepto: null,
    observaciones: null,
    estatus: 'emitido',
    tratamiento: 'sin_iva',
    subtotal: 960,
    descuento: 0,
    iva: 0,
    total: 960,
    saldo: 960,
    uuid: null,
    fechaTimbrado: null,
    estadoSat: null,
    cfdiPacId: null,
    cfdiPacModalidad: null,
    cancelacionEstado: null,
    usoCfdi: null,
    formaPago: null,
    metodoPago: null,
    regimen: null,
    codigoPostal: null,
    origenes: [
      { id: 2002, serie: 'N', numero: 2, fecha: '2026-09-26', estatus: 'Emitido', total: 4800, cliente: 'Benigno Moya' },
    ],
    partidas: [
      { id: 1, origenId: 2002, clave: 'SRV-01', descripcion: 'Servicio de impresión', cantidad: 1, precio: 960, importe: 960 },
    ],
    aplicaciones: [],
  },
  {
    id: 1005,
    serie: 'NC',
    numero: 5,
    fecha: '2026-09-25',
    cliente: 'ESCUELA KEMPER URGATE',
    contactoId: 12,
    ...fiscalKemper,
    motivo: 'devolucion',
    concepto: null,
    observaciones: null,
    estatus: 'emitido',
    tratamiento: 'normal',
    subtotal: 2800,
    descuento: 0,
    iva: 448,
    total: 3248,
    saldo: 3248,
    uuid: null,
    fechaTimbrado: null,
    estadoSat: null,
    cfdiPacId: null,
    cfdiPacModalidad: null,
    cancelacionEstado: null,
    origenes: [
      { id: 7005, serie: 'A', numero: 5, fecha: '2026-08-22', estatus: 'Emitido', total: 35606.8, cliente: 'ESCUELA KEMPER URGATE' },
    ],
    partidas: [
      { id: 1, origenId: 7005, clave: 'TON-85A', descripcion: 'Tóner HP 85A negro CE285A', cantidad: 2, precio: 1400, importe: 2800 },
    ],
    aplicaciones: [],
  },
  {
    id: 1002,
    serie: 'NCR',
    numero: 2,
    fecha: '2026-09-26',
    cliente: 'Benigno Moya',
    contactoId: 4,
    ...fiscalBenigno,
    motivo: 'otro',
    concepto: 'Ajuste comercial',
    observaciones: 'Nota capturada sin factura de origen.',
    estatus: 'emitido',
    tratamiento: 'normal',
    subtotal: 1293.1,
    descuento: 0,
    iva: 206.9,
    total: 1500,
    saldo: 1500,
    uuid: null,
    fechaTimbrado: null,
    estadoSat: null,
    cfdiPacId: null,
    cfdiPacModalidad: null,
    cancelacionEstado: null,
    origenes: [],
    partidas: [
      { id: 1, origenId: null, clave: 'AJU-01', descripcion: 'Ajuste comercial', cantidad: 1, precio: 1293.1, importe: 1293.1 },
    ],
    aplicaciones: [],
  },
  {
    id: 1008,
    serie: 'NCR',
    numero: 8,
    fecha: '2026-09-24',
    cliente: 'ESCUELA KEMPER URGATE',
    contactoId: 12,
    ...fiscalKemper,
    motivo: 'bonificacion',
    concepto: null,
    observaciones: null,
    estatus: 'timbrado',
    tratamiento: 'normal',
    subtotal: 2000,
    descuento: 0,
    iva: 320,
    total: 2320,
    saldo: 2320,
    uuid: '8F3C2A10-4B21-4E0A-9C11-A1B2C3D4E5F6',
    fechaTimbrado: '2026-09-24T16:40:00',
    estadoSat: 'Vigente',
    cfdiPacId: 'facturama-web',
    cfdiPacModalidad: 'web',
    cancelacionEstado: null,
    origenes: [
      { id: 7003, serie: 'A', numero: 3, fecha: '2026-08-20', estatus: 'Timbrado', total: 11200, cliente: 'ESCUELA KEMPER URGATE' },
    ],
    partidas: [
      { id: 1, origenId: 7003, clave: 'BON-03', descripcion: 'Bonificación sobre tóner', cantidad: 1, precio: 2000, importe: 2000 },
    ],
    aplicaciones: [],
  },
  {
    id: 2002,
    serie: 'NC',
    numero: 2,
    fecha: '2026-09-25',
    cliente: 'ESCUELA KEMPER URGATE',
    contactoId: 12,
    ...fiscalKemper,
    motivo: 'devolucion',
    concepto: null,
    observaciones: null,
    estatus: 'timbrado',
    tratamiento: 'normal',
    subtotal: 5000,
    descuento: 0,
    iva: 800,
    total: 5800,
    saldo: 3500,
    uuid: 'A91E0042-77C1-4D55-B210-0C0FF1A29B10',
    fechaTimbrado: '2026-09-25T11:12:00',
    estadoSat: 'Vigente',
    cfdiPacId: 'facturama-web',
    cfdiPacModalidad: 'web',
    cancelacionEstado: null,
    origenes: [
      { id: 7007, serie: 'A', numero: 7, fecha: '2026-09-25', estatus: 'Timbrado', total: 11600, cliente: 'ESCUELA KEMPER URGATE' },
    ],
    partidas: [
      { id: 1, origenId: 7007, clave: 'TON-85A', descripcion: 'Tóner HP 85A negro CE285A', cantidad: 2, precio: 1800, importe: 3600 },
      { id: 2, origenId: 7007, clave: 'PAP-BOND', descripcion: 'Papel bond carta', cantidad: 14, precio: 100, importe: 1400 },
    ],
    aplicaciones: [
      { id: 51, serie: 'N', numero: 3, fecha: '2026-09-26', monto: 2300 },
    ],
  },
  {
    id: 1004,
    serie: 'NCR',
    numero: 4,
    fecha: '2026-09-22',
    cliente: 'ESCUELA KEMPER URGATE',
    contactoId: 12,
    ...fiscalKemper,
    motivo: 'devolucion',
    concepto: null,
    observaciones: 'Devolución consolidada de tres facturas.',
    estatus: 'timbrado',
    tratamiento: 'normal',
    subtotal: 4000,
    descuento: 0,
    iva: 640,
    total: 4640,
    saldo: 2840,
    uuid: 'C20B91AA-1D44-4F80-8E77-55A0B1C2D3E4',
    fechaTimbrado: '2026-09-22T09:05:00',
    estadoSat: 'Vigente',
    cfdiPacId: 'facturama-web',
    cfdiPacModalidad: 'web',
    cancelacionEstado: null,
    origenes: [
      { id: 7003, serie: 'A', numero: 3, fecha: '2026-08-20', estatus: 'Timbrado', total: 11200, cliente: 'ESCUELA KEMPER URGATE' },
      { id: 7005, serie: 'A', numero: 5, fecha: '2026-08-22', estatus: 'Emitido', total: 35606.8, cliente: 'ESCUELA KEMPER URGATE' },
      { id: 7007, serie: 'A', numero: 7, fecha: '2026-09-25', estatus: 'Timbrado', total: 11600, cliente: 'ESCUELA KEMPER URGATE' },
    ],
    partidas: [
      { id: 1, origenId: 7003, clave: 'TON-85A', descripcion: 'Tóner HP 85A negro CE285A', cantidad: 1, precio: 1500, importe: 1500 },
      { id: 2, origenId: 7005, clave: 'TON-12A', descripcion: 'Tóner HP 12A', cantidad: 2, precio: 900, importe: 1800 },
      { id: 3, origenId: 7007, clave: 'PAP-BOND', descripcion: 'Papel bond carta', cantidad: 7, precio: 100, importe: 700 },
    ],
    aplicaciones: [
      { id: 61, serie: 'A', numero: 2, fecha: '2026-09-24', monto: 1000 },
      { id: 62, serie: 'N', numero: 3, fecha: '2026-09-26', monto: 800 },
    ],
  },
  {
    id: 1006,
    serie: 'NCR',
    numero: 6,
    fecha: '2026-09-20',
    cliente: 'Benigno Moya',
    contactoId: 4,
    ...fiscalBenigno,
    motivo: 'devolucion',
    concepto: null,
    observaciones: null,
    estatus: 'timbrado',
    tratamiento: 'normal',
    subtotal: 1000,
    descuento: 0,
    iva: 160,
    total: 1160,
    saldo: 0,
    uuid: '11AA22BB-33CC-44DD-55EE-66FF77889900',
    fechaTimbrado: '2026-09-20T13:20:00',
    estadoSat: 'Vigente',
    cfdiPacId: 'facturama-web',
    cfdiPacModalidad: 'web',
    cancelacionEstado: null,
    origenes: [
      { id: 2002, serie: 'N', numero: 2, fecha: '2026-09-18', estatus: 'Emitido', total: 4800, cliente: 'Benigno Moya' },
    ],
    partidas: [
      { id: 1, origenId: 2002, clave: 'SRV-01', descripcion: 'Servicio de impresión', cantidad: 1, precio: 1000, importe: 1000 },
    ],
    aplicaciones: [
      { id: 71, serie: 'N', numero: 2, fecha: '2026-09-21', monto: 1160 },
    ],
  },
  {
    id: 1009,
    serie: 'NCR',
    numero: 9,
    fecha: '2026-09-18',
    cliente: 'Agencia de Viajes Internaco',
    contactoId: 21,
    rfc: 'AVI850101XYZ',
    usoCfdi: 'G03',
    formaPago: '99',
    metodoPago: 'PPD',
    regimen: '601',
    codigoPostal: '06600',
    motivo: 'otro',
    concepto: 'Ajuste por cortesía',
    observaciones: null,
    estatus: 'timbrado',
    tratamiento: 'normal',
    subtotal: 2000,
    descuento: 0,
    iva: 320,
    total: 2320,
    saldo: 1520,
    uuid: '90AB12CD-34EF-56AB-78CD-90EF12AB34CD',
    fechaTimbrado: '2026-09-18T10:00:00',
    estadoSat: 'Vigente',
    cfdiPacId: 'facturama-lite',
    cfdiPacModalidad: 'lite',
    cancelacionEstado: null,
    origenes: [],
    partidas: [
      { id: 1, origenId: null, clave: 'AJU-02', descripcion: 'Ajuste por cortesía', cantidad: 1, precio: 2000, importe: 2000 },
    ],
    aplicaciones: [
      { id: 81, serie: 'FAC', numero: 40, fecha: '2026-09-19', monto: 800 },
    ],
  },
  {
    id: 1003,
    serie: 'NCR',
    numero: 3,
    fecha: '2026-09-15',
    cliente: 'ESCUELA KEMPER URGATE',
    contactoId: 12,
    ...fiscalKemper,
    motivo: 'bonificacion',
    concepto: null,
    observaciones: null,
    estatus: 'cancelado',
    tratamiento: 'normal',
    subtotal: 500,
    descuento: 0,
    iva: 80,
    total: 580,
    saldo: 0,
    uuid: 'DEADBEEF-0000-4000-8000-000000000003',
    fechaTimbrado: '2026-09-15T08:30:00',
    estadoSat: 'Cancelado',
    cfdiPacId: 'facturama-web',
    cfdiPacModalidad: 'web',
    cancelacionEstado: 'cancelada',
    origenes: [
      { id: 7003, serie: 'A', numero: 3, fecha: '2026-08-20', estatus: 'Timbrado', total: 11200, cliente: 'ESCUELA KEMPER URGATE' },
    ],
    partidas: [
      { id: 1, origenId: 7003, clave: 'BON-01', descripcion: 'Bonificación comercial', cantidad: 1, precio: 500, importe: 500 },
    ],
    aplicaciones: [],
  },
];

export const ESTATUS_OPCIONES: Array<{ value: EstatusNota; label: string }> = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'emitido', label: 'Emitido' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'timbrado', label: 'Timbrado' },
];
