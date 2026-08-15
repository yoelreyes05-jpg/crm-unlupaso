import type { CrudOptions } from "./crud";

/**
 * Definición central de cada recurso de MAXMATT SHOP.
 * Un único lugar donde se declara tabla, campos editables, filtros y búsqueda.
 */

export const CLIENTES: CrudOptions = {
  table: "ti_clientes",
  fields: [
    "nombre", "tipo", "cedula_rnc", "telefono", "telefono2", "email", "direccion",
    "permite_credito", "limite_credito", "dias_credito", "notas", "activo", "usuario",
  ],
  required: ["nombre"],
  searchFields: ["nombre", "cedula_rnc", "telefono", "codigo", "email"],
  filters: ["activo", "tipo", "permite_credito"],
  orderBy: "nombre",
  ascending: true,
};

export const CLIENTES_VISTA: CrudOptions = {
  table: "ti_v_clientes",
  fields: [],
  searchFields: ["nombre", "cedula_rnc", "telefono", "codigo"],
  filters: ["activo", "tipo"],
  orderBy: "nombre",
  ascending: true,
};

export const PROVEEDORES: CrudOptions = {
  table: "ti_proveedores",
  fields: [
    "nombre", "contacto", "rnc", "telefono", "email", "direccion",
    "categoria", "dias_credito", "notas", "activo", "usuario",
  ],
  required: ["nombre"],
  searchFields: ["nombre", "contacto", "rnc", "telefono", "codigo"],
  filters: ["activo", "categoria"],
  orderBy: "nombre",
  ascending: true,
};

export const PRODUCTOS: CrudOptions = {
  table: "ti_productos",
  fields: [
    // El código se genera solo (ART-00001) pero se puede cambiar a mano
    "codigo",
    "codigo_barra", "nombre", "descripcion", "categoria", "categoria_id", "marca", "unidad",
    "costo", "precio", "itbis_pct", "stock_minimo", "ubicacion",
    "proveedor_id", "imagen_url", "activo", "usuario",
    // Pacas / lotes: el costo por pieza lo calcula solo la base de datos
    "tipo_inventario", "costo_lote", "piezas_lote", "lote_codigo", "fecha_lote", "precio_sugerido",
  ],
  required: ["nombre"],
  searchFields: ["nombre", "descripcion", "codigo", "codigo_barra", "marca", "lote_codigo"],
  filters: ["activo", "categoria", "categoria_id", "proveedor_id", "tipo_inventario"],
  // Si se deja el código en blanco, la base pone ART-00001 y sigue contando
  conDefecto: ["codigo"],
  orderBy: "nombre",
  ascending: true,
};

export const CATEGORIAS: CrudOptions = {
  table: "ti_categorias",
  fields: ["nombre", "descripcion", "color", "orden", "activo", "usuario"],
  required: ["nombre"],
  searchFields: ["nombre", "descripcion"],
  filters: ["activo"],
  orderBy: "orden",
  ascending: true,
};

/** Vista de pacas: cuánto costó el lote, cuánto se ha recuperado y qué falta. */
export const LOTES_VISTA: CrudOptions = {
  table: "ti_v_lotes",
  fields: [],
  searchFields: ["nombre", "codigo", "lote_codigo", "categoria_nombre"],
  filters: ["activo", "categoria_id", "estado_lote", "proveedor_id"],
  orderBy: "fecha_lote",
  ascending: false,
};

export const PRODUCTOS_VISTA: CrudOptions = {
  table: "ti_v_productos",
  fields: [],
  searchFields: ["nombre", "descripcion", "codigo", "codigo_barra", "marca", "lote_codigo"],
  filters: ["activo", "categoria", "categoria_id", "estado_stock", "proveedor_id", "tipo_inventario"],
  orderBy: "nombre",
  ascending: true,
};

export const INVENTARIO: CrudOptions = {
  table: "ti_movimientos_inventario",
  fields: [
    "producto_id", "fecha", "tipo", "cantidad", "costo_unitario",
    "referencia", "origen", "origen_id", "notas", "usuario",
  ],
  required: ["producto_id", "tipo", "cantidad"],
  filters: ["producto_id", "tipo", "origen"],
  orderBy: "created_at",
  ascending: false,
};

export const COMPRAS: CrudOptions = {
  table: "ti_compras",
  fields: [
    "proveedor_id", "fecha", "ncf", "condicion", "fecha_vence",
    "descuento", "estado", "notas", "usuario",
  ],
  searchFields: ["codigo", "ncf"],
  filters: ["proveedor_id", "estado", "condicion"],
  orderBy: "fecha",
  ascending: false,
};

export const COMPRAS_VISTA: CrudOptions = {
  table: "ti_v_compras",
  fields: [],
  searchFields: ["codigo", "ncf", "proveedor_nombre"],
  filters: ["proveedor_id", "estado", "condicion", "estado_visual"],
  orderBy: "fecha",
  ascending: false,
};

export const COMPRA_ITEMS: CrudOptions = {
  table: "ti_compra_items",
  fields: ["compra_id", "producto_id", "cantidad", "costo", "itbis_pct", "importe"],
  required: ["compra_id", "producto_id", "cantidad"],
  filters: ["compra_id"],
  orderBy: "created_at",
  ascending: true,
};

export const VENTAS: CrudOptions = {
  table: "ti_ventas",
  fields: [
    "cliente_id", "fecha", "ncf", "condicion", "fecha_vence", "descuento",
    "metodo_pago", "estado", "caja_sesion_id", "notas", "usuario",
  ],
  searchFields: ["codigo", "ncf"],
  filters: ["cliente_id", "estado", "condicion", "metodo_pago"],
  orderBy: "fecha",
  ascending: false,
};

export const VENTAS_VISTA: CrudOptions = {
  table: "ti_v_ventas",
  fields: [],
  searchFields: ["codigo", "ncf", "cliente_nombre"],
  filters: ["cliente_id", "estado", "condicion", "estado_visual"],
  orderBy: "fecha",
  ascending: false,
};

export const VENTA_ITEMS: CrudOptions = {
  table: "ti_venta_items",
  fields: ["venta_id", "producto_id", "descripcion", "cantidad", "precio", "costo", "itbis_pct", "descuento", "importe"],
  required: ["venta_id", "producto_id", "cantidad"],
  filters: ["venta_id"],
  orderBy: "created_at",
  ascending: true,
};

export const COBROS: CrudOptions = {
  table: "ti_cobros",
  fields: ["venta_id", "cliente_id", "fecha", "monto", "metodo_pago", "referencia", "notas", "anulado", "usuario"],
  required: ["venta_id", "monto"],
  searchFields: ["recibo", "referencia"],
  filters: ["venta_id", "cliente_id", "anulado", "metodo_pago"],
  orderBy: "fecha",
  ascending: false,
};

export const PAGOS_PROVEEDOR: CrudOptions = {
  table: "ti_pagos_proveedor",
  fields: ["compra_id", "proveedor_id", "fecha", "monto", "metodo_pago", "referencia", "notas", "anulado", "usuario"],
  required: ["compra_id", "monto"],
  searchFields: ["referencia"],
  filters: ["compra_id", "proveedor_id", "anulado"],
  orderBy: "fecha",
  ascending: false,
};

export const GASTOS: CrudOptions = {
  table: "ti_gastos",
  fields: ["fecha", "categoria", "concepto", "monto", "metodo_pago", "proveedor_id", "referencia", "notas", "usuario"],
  required: ["concepto", "monto"],
  searchFields: ["concepto", "categoria", "referencia"],
  filters: ["categoria", "metodo_pago", "proveedor_id"],
  orderBy: "fecha",
  ascending: false,
};

export const CAJA: CrudOptions = {
  table: "ti_caja_sesiones",
  fields: ["monto_inicial", "monto_contado", "notas", "abierta_por", "cerrada_por"],
  filters: ["estado"],
  orderBy: "fecha_apertura",
  ascending: false,
};

export const CAJA_MOVIMIENTOS: CrudOptions = {
  table: "ti_caja_movimientos",
  fields: [
    "sesion_id", "fecha", "tipo", "categoria", "concepto", "monto",
    "metodo_pago", "referencia", "origen", "origen_id", "usuario",
  ],
  required: ["tipo", "concepto", "monto"],
  searchFields: ["concepto", "categoria", "referencia"],
  filters: ["sesion_id", "tipo", "categoria", "origen", "metodo_pago"],
  orderBy: "created_at",
  ascending: false,
};

/** Vistas de solo lectura accesibles vía /api/tienda/vistas/[nombre] */
export const VISTAS_PERMITIDAS = [
  "ti_v_productos",
  "ti_v_ventas",
  "ti_v_cuentas_cobrar",
  "ti_v_compras",
  "ti_v_cuentas_pagar",
  "ti_v_clientes",
  "ti_v_caja_actual",
  "ti_v_resultados_mensuales",
  "ti_v_dashboard",
  "ti_v_top_productos",
  "ti_v_lotes",
  "ti_v_ganancia_categoria",
] as const;
