export interface SaldoInicialCuenta {
  cuenta_id: number;
  cuenta: string;
  descripcion: string;
  naturaleza_saldo: 'D' | 'A' | null;
  naturaleza_descripcion: string | null;
  saldo_inicial: number;
  observaciones: string | null;
  origen: string | null;
  estado: 'capturado' | 'sin_capturar';
  tiene_polizas_aplicadas_ejercicio: boolean;
}

export interface ItemSaldoInicialLote {
  cuenta_id: number;
  saldo_inicial: number | null;
  observaciones?: string | null;
}

export interface ErrorLoteSaldoInicial {
  cuenta_id: number;
  motivo: string;
}

export interface ResultadoLoteSaldosIniciales {
  actualizadas: number;
  errores: ErrorLoteSaldoInicial[];
}
