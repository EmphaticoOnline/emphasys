export interface CuentaSaldoMes {
  id: number;
  cuenta: string;
  descripcion: string;
  nivel: number;
  afectable: boolean;
  rango_cuenta_id: number | null;
  naturaleza_saldo: 'D' | 'A';
  saldo_inicial: number;
  cargos: number;
  abonos: number;
  saldo_final: number;
}

export interface SaldoAnioMes {
  periodo: number;
  nombre_mes: string;
  cargos: number;
  abonos: number;
  saldo: number;
}

export interface SaldoAnioResultado {
  cuenta: string;
  descripcion: string;
  ejercicio: number;
  meses: SaldoAnioMes[];
  totales: { cargos: number; abonos: number; saldo_final: number };
}

export const NOMBRES_MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] as const;

export interface AuxiliarMovimiento {
  poliza_id: number;
  poliza_numero: number;
  referencia: string | null;
  tipo_poliza: string;
  renglon: number;
  fecha: string;
  concepto: string | null;
  cargo: number;
  abono: number;
}

export interface AuxiliarCuentaResultado {
  cuenta: { id: number; cuenta: string; descripcion: string };
  ejercicio: number;
  periodo: number;
  resumen: { cargos: number; abonos: number; numero_movimientos: number };
  movimientos: AuxiliarMovimiento[];
}
