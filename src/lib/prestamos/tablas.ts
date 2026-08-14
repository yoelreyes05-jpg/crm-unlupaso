import type { CrudOptions } from "./crud";

/**
 * Definición central de cada recurso del módulo de Préstamos.
 * Un único lugar donde se declara tabla, campos editables, filtros y búsqueda.
 */

export const CLIENTES: CrudOptions = {
  table: "pr_clientes",
  fields: [
    "nombre", "cedula", "telefono", "telefono2", "email", "direccion",
    "ocupacion", "lugar_trabajo", "ingreso_mensual",
    "ref1_nombre", "ref1_telefono", "ref2_nombre", "ref2_telefono",
    "notas", "activo", "usuario",
  ],
  required: ["nombre"],
  searchFields: ["nombre", "cedula", "telefono", "codigo", "email"],
  filters: ["activo"],
  orderBy: "nombre",
  ascending: true,
};

export const INVERSIONISTAS: CrudOptions = {
  table: "pr_inversionistas",
  fields: [
    "nombre", "cedula", "telefono", "email", "direccion",
    "modo_reparto_default", "tasa_default", "porcentaje_default",
    "notas", "activo", "usuario",
  ],
  required: ["nombre"],
  searchFields: ["nombre", "cedula", "telefono", "codigo", "email"],
  filters: ["activo", "modo_reparto_default"],
  orderBy: "nombre",
  ascending: true,
};

export const INVERSIONISTAS_VISTA: CrudOptions = {
  table: "pr_v_inversionistas",
  fields: [],
  searchFields: ["nombre", "cedula", "telefono", "codigo"],
  filters: ["activo"],
  orderBy: "nombre",
  ascending: true,
};

export const MOVIMIENTOS: CrudOptions = {
  table: "pr_movimientos_inversionista",
  fields: ["inversionista_id", "fecha", "tipo", "monto", "descripcion", "usuario"],
  required: ["inversionista_id", "tipo", "monto"],
  filters: ["inversionista_id", "tipo"],
  orderBy: "fecha",
  ascending: false,
};

export const PRESTAMOS: CrudOptions = {
  table: "pr_prestamos",
  fields: [
    "cliente_id", "inversionista_id", "capital", "tasa_interes", "metodo",
    "frecuencia", "dias_periodo", "num_cuotas", "fecha_inicio", "fecha_primer_pago",
    "modo_reparto", "tasa_inversionista", "porcentaje_inversionista",
    "mora_activa", "tasa_mora", "dias_gracia", "garantia", "notas", "estado", "usuario",
  ],
  required: ["cliente_id", "capital", "tasa_interes", "num_cuotas"],
  searchFields: ["codigo"],
  filters: ["cliente_id", "inversionista_id", "estado", "frecuencia", "metodo"],
  orderBy: "created_at",
  ascending: false,
};

export const PRESTAMOS_VISTA: CrudOptions = {
  table: "pr_v_prestamos",
  fields: [],
  searchFields: ["codigo", "cliente_nombre", "cliente_cedula"],
  filters: ["cliente_id", "inversionista_id", "estado", "estado_visual"],
  orderBy: "created_at",
  ascending: false,
};

export const CUOTAS: CrudOptions = {
  table: "pr_cuotas",
  fields: [
    "prestamo_id", "ciclo", "numero", "fecha_vencimiento", "capital", "interes",
    "total", "saldo_despues", "capital_pagado", "interes_pagado",
    "mora_generada", "mora_pagada", "estado", "fecha_pago", "activa", "origen", "notas",
  ],
  required: ["prestamo_id", "numero", "fecha_vencimiento"],
  filters: ["prestamo_id", "estado", "activa", "ciclo"],
  orderBy: "fecha_vencimiento",
  ascending: true,
};

export const CUOTAS_VISTA: CrudOptions = {
  table: "pr_v_cuotas",
  fields: [],
  searchFields: ["cliente_nombre", "prestamo_codigo"],
  filters: ["prestamo_id", "estado", "estado_visual", "activa", "cliente_id", "inversionista_id"],
  orderBy: "fecha_vencimiento",
  ascending: true,
};

export const PAGOS: CrudOptions = {
  table: "pr_pagos",
  fields: [
    "prestamo_id", "cuota_id", "fecha", "monto", "tipo", "monto_capital",
    "monto_interes", "monto_mora", "metodo_pago", "referencia", "notas", "anulado", "usuario",
  ],
  required: ["prestamo_id", "monto"],
  searchFields: ["recibo", "referencia"],
  filters: ["prestamo_id", "tipo", "metodo_pago", "anulado"],
  orderBy: "fecha",
  ascending: false,
};

export const DISTRIBUCIONES: CrudOptions = {
  table: "pr_distribuciones",
  fields: [],
  filters: ["prestamo_id", "inversionista_id"],
  orderBy: "fecha",
  ascending: false,
};

export const REENGANCHES: CrudOptions = {
  table: "pr_reenganches",
  fields: ["prestamo_id", "fecha", "monto_adicional", "notas", "usuario"],
  filters: ["prestamo_id"],
  orderBy: "fecha",
  ascending: false,
};

/** Vistas de solo lectura accesibles vía /api/prestamos/vistas/[nombre] */
export const VISTAS_PERMITIDAS = [
  "pr_v_prestamos",
  "pr_v_cuotas",
  "pr_v_inversionistas",
  "pr_v_ganancias_mensuales",
  "pr_v_ganancias_inversionista",
  "pr_v_dashboard",
  "pr_v_cobranza",
] as const;
