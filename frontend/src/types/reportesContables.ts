export interface BalanzaAnaliticaCuenta {
  id: number;
  cuenta: string;
  descripcion: string;
  nivel: number;
  afectable: boolean;
  naturaleza_saldo: 'D' | 'A';
  saldo_inicial: number;
  cargos: number;
  abonos: number;
  saldo_final: number;
}

export interface BalanzaAnaliticaResultado {
  ejercicio: number;
  periodo_inicial: number;
  periodo_final: number;
  cuentas: BalanzaAnaliticaCuenta[];
  totales: { cargos: number; abonos: number };
  cuadra: boolean;
}

export interface EstadoResultadosCuenta {
  id: number;
  cuenta: string;
  descripcion: string;
  importe: number;
}

export interface EstadoResultadosResultado {
  ejercicio: number;
  periodo_inicial: number;
  periodo_final: number;
  ingresos: EstadoResultadosCuenta[];
  egresos: EstadoResultadosCuenta[];
  total_ingresos: number;
  total_egresos: number;
  utilidad_periodo: number;
}

export interface BalanceGeneralCuenta {
  id: number;
  cuenta: string;
  descripcion: string;
  saldo: number;
}

export interface BalanceGeneralGrupo {
  grupo: string;
  cuentas: BalanceGeneralCuenta[];
  subtotal: number;
}

export interface BalanceGeneralResultado {
  ejercicio: number;
  periodo: number;
  activo: BalanceGeneralGrupo[];
  pasivo: BalanceGeneralGrupo[];
  capital: BalanceGeneralGrupo[];
  total_activo: number;
  total_pasivo: number;
  total_capital: number;
  diferencia: number;
  cuadrado: boolean;
}
