import type { Frecuencia, Metodo, ModoReparto, Prorrateo } from "@/lib/prestamos/calculo";

export type { Frecuencia, Metodo, ModoReparto, Prorrateo };

/** Tablas pr_* del módulo de Préstamos. */

export interface PrConfig {
  id: number;
  nombre_empresa: string;
  rnc: string | null;
  telefono: string | null;
  direccion: string | null;
  moneda: string;
  simbolo_moneda: string;
  metodo_prorrateo: Prorrateo;
  dias_gracia: number;
  tasa_mora: number;
  mora_activa_default: boolean;
  tasa_cliente_default: number;
  tasa_inv_default: number;
  logo_url: string | null;
}

export interface PrCliente {
  id: string;
  codigo: string;
  nombre: string;
  cedula: string | null;
  telefono: string | null;
  telefono2: string | null;
  email: string | null;
  direccion: string | null;
  ocupacion: string | null;
  lugar_trabajo: string | null;
  ingreso_mensual: number | null;
  ref1_nombre: string | null;
  ref1_telefono: string | null;
  ref2_nombre: string | null;
  ref2_telefono: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
}

export interface PrInversionista {
  id: string;
  codigo: string;
  nombre: string;
  cedula: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  modo_reparto_default: ModoReparto;
  tasa_default: number;
  porcentaje_default: number;
  notas: string | null;
  activo: boolean;
  created_at: string;
}

/** Vista pr_v_inversionistas */
export interface PrInversionistaVista extends PrInversionista {
  aportes: number;
  retiros: number;
  capital_colocado: number;
  prestamos_activos: number;
  capital_recuperado: number;
  interes_ganado: number;
  capital_disponible: number;
  capital_en_calle: number;
}

export interface PrMovimientoInversionista {
  id: string;
  inversionista_id: string;
  fecha: string;
  tipo: "aporte" | "retiro" | "retiro_ganancia" | "ajuste";
  monto: number;
  descripcion: string | null;
}

export interface PrPrestamo {
  id: string;
  codigo: string;
  cliente_id: string;
  inversionista_id: string | null;
  capital: number;
  capital_original: number;
  tasa_interes: number;
  metodo: Metodo;
  frecuencia: Frecuencia;
  dias_periodo: number;
  num_cuotas: number;
  fecha_inicio: string;
  fecha_primer_pago: string;
  fecha_fin_estimada: string;
  modo_reparto: ModoReparto;
  tasa_inversionista: number;
  porcentaje_inversionista: number;
  mora_activa: boolean;
  tasa_mora: number;
  dias_gracia: number;
  monto_cuota: number;
  interes_programado: number;
  total_programado: number;
  estado: "activo" | "pagado" | "cancelado";
  ciclo: number;
  garantia: string | null;
  notas: string | null;
  created_at: string;
}

/** Vista pr_v_prestamos */
export interface PrPrestamoVista extends PrPrestamo {
  cliente_nombre: string;
  cliente_codigo: string;
  cliente_telefono: string | null;
  cliente_cedula: string | null;
  cliente_direccion: string | null;
  inversionista_nombre: string | null;
  inversionista_codigo: string | null;
  capital_programado: number;
  capital_pagado: number;
  interes_pagado: number;
  mora_generada: number;
  mora_pagada: number;
  saldo_capital: number;
  saldo_interes: number;
  saldo_total: number;
  total_cobrado: number;
  cuotas_pagadas: number;
  cuotas_totales: number;
  cuotas_pendientes: number;
  cuotas_atrasadas: number;
  proximo_vencimiento: string | null;
  fecha_fin_real: string | null;
  estado_visual: "al_dia" | "atrasado" | "pagado" | "cancelado";
  avance_pct: number;
}

export type PrEstadoCuota =
  | "pendiente" | "parcial" | "pagada" | "solo_interes" | "reemplazada" | "condonada";

export interface PrCuota {
  id: string;
  prestamo_id: string;
  ciclo: number;
  numero: number;
  fecha_vencimiento: string;
  capital: number;
  interes: number;
  total: number;
  saldo_despues: number;
  capital_pagado: number;
  interes_pagado: number;
  mora_generada: number;
  mora_pagada: number;
  estado: PrEstadoCuota;
  fecha_pago: string | null;
  activa: boolean;
  origen: "cronograma" | "solo_interes" | "reenganche" | "manual";
  notas: string | null;
}

/** Vista pr_v_cuotas */
export interface PrCuotaVista extends PrCuota {
  prestamo_codigo: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_telefono: string | null;
  inversionista_id: string | null;
  pendiente: number;
  mora_pendiente: number;
  dias_atraso: number;
  estado_visual:
    | "pendiente" | "parcial" | "pagada" | "atrasada"
    | "solo_interes" | "vence_hoy" | "reemplazada" | "condonada";
}

export type PrTipoPago = "cuota" | "solo_interes" | "abono_capital" | "saldo_total" | "mora";

export interface PrPago {
  id: string;
  recibo: string;
  prestamo_id: string;
  cuota_id: string | null;
  fecha: string;
  monto: number;
  tipo: PrTipoPago;
  monto_capital: number;
  monto_interes: number;
  monto_mora: number;
  metodo_pago: "efectivo" | "transferencia" | "cheque" | "tarjeta" | "otro";
  referencia: string | null;
  notas: string | null;
  anulado: boolean;
  created_at: string;
}

export interface PrDistribucion {
  id: string;
  pago_id: string;
  prestamo_id: string;
  inversionista_id: string | null;
  fecha: string;
  capital_devuelto: number;
  interes_total: number;
  interes_inversionista: number;
  interes_administrador: number;
  mora_administrador: number;
}

export interface PrReenganche {
  id: string;
  prestamo_id: string;
  fecha: string;
  monto_adicional: number;
  saldo_capital_previo: number;
  interes_capitalizado: number;
  capital_nuevo: number;
  tasa_previa: number;
  tasa_nueva: number;
  num_cuotas_nuevas: number;
  frecuencia_nueva: string;
  ciclo_previo: number;
  ciclo_nuevo: number;
  notas: string | null;
}

/** Vista pr_v_dashboard */
export interface PrDashboard {
  clientes_activos: number;
  inversionistas_activos: number;
  prestamos_activos: number;
  capital_colocado: number;
  capital_por_recuperar: number;
  cartera_por_cobrar: number;
  prestamos_atrasados: number;
  monto_atrasado: number;
  interes_cobrado_total: number;
  ganancia_administrador: number;
  ganancia_inversionistas: number;
  ganancia_admin_mes: number;
  cobrado_mes: number;
}

/** Vista pr_v_ganancias_mensuales */
export interface PrGananciaMensual {
  mes: string;
  capital_recuperado: number;
  interes_total: number;
  ganancia_inversionistas: number;
  ganancia_administrador: number;
  prestamos_con_movimiento: number;
}
