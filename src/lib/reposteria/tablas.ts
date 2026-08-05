import type { CrudOptions } from "./crud";

/**
 * Definición central de cada recurso del ERP Repostería.
 * Un único lugar donde se declara tabla, campos editables, filtros y búsqueda.
 */

export const CLIENTES: CrudOptions = {
  table: "rep_clientes",
  fields: ["nombre","apellido","email","telefono","cedula_rnc","direccion","tipo","notas","activo","usuario"],
  required: ["nombre"],
  searchFields: ["nombre","apellido","telefono","email","cedula_rnc"],
  filters: ["activo","tipo"],
  orderBy: "nombre",
  ascending: true,
};

export const PROVEEDORES: CrudOptions = {
  table: "rep_proveedores",
  fields: ["nombre","contacto","email","telefono","rnc","direccion","categoria","notas","activo","usuario"],
  required: ["nombre"],
  searchFields: ["nombre","contacto","telefono","rnc"],
  filters: ["activo","categoria"],
  orderBy: "nombre",
  ascending: true,
};

export const INGREDIENTES: CrudOptions = {
  table: "rep_ingredientes",
  fields: [
    "nombre","descripcion","categoria","unidad","costo_unitario","stock_actual",
    "stock_minimo","punto_reorden","ubicacion","unidad_compra","costo_compra",
    "proveedor_id","activo","usuario",
  ],
  required: ["nombre"],
  searchFields: ["nombre","descripcion","ubicacion"],
  filters: ["activo","categoria","proveedor_id"],
  orderBy: "nombre",
  ascending: true,
};

export const PRODUCTOS: CrudOptions = {
  table: "rep_productos",
  fields: [
    "nombre","descripcion","categoria","codigo","precio_venta","costo_estimado",
    "itbis","unidad","imagen_url","vende_en_pos","activo","usuario",
  ],
  required: ["nombre","precio_venta"],
  searchFields: ["nombre","descripcion","codigo"],
  filters: ["activo","categoria","vende_en_pos"],
  orderBy: "nombre",
  ascending: true,
};

export const RECETAS: CrudOptions = {
  table: "rep_recetas",
  fields: ["producto_id","nombre","descripcion","rendimiento","unidad_rendimiento","instrucciones","activo","usuario"],
  required: ["nombre"],
  searchFields: ["nombre","descripcion"],
  filters: ["activo","producto_id"],
  orderBy: "nombre",
  ascending: true,
};

export const RECETA_INGREDIENTES: CrudOptions = {
  table: "rep_receta_ingredientes",
  fields: ["receta_id","ingrediente_id","cantidad","unidad","notas"],
  required: ["receta_id","ingrediente_id","cantidad"],
  filters: ["receta_id","ingrediente_id"],
  orderBy: "id",
  ascending: true,
};

export const LOTES: CrudOptions = {
  table: "rep_lotes",
  fields: [
    "producto_id","receta_id","nombre_lote","categoria","cantidad_inicial","cantidad_actual",
    "unidad","fecha_produccion","fecha_vencimiento","costo_unitario","precio_venta",
    "estado","evento_id","notas","usuario",
  ],
  required: ["nombre_lote","fecha_vencimiento"],
  searchFields: ["nombre_lote","notas"],
  filters: ["estado","categoria","producto_id","evento_id"],
  orderBy: "fecha_vencimiento",
  ascending: true,
};

export const LOTE_MOVIMIENTOS: CrudOptions = {
  table: "rep_lote_movimientos",
  fields: ["lote_id","tipo","cantidad","motivo","evento_id","venta_id","usuario"],
  required: ["lote_id","tipo","cantidad"],
  filters: ["lote_id","tipo"],
};

export const EQUIPOS: CrudOptions = {
  table: "rep_equipos",
  fields: [
    "nombre","descripcion","categoria","codigo","cantidad_total","precio_alquiler",
    "costo_reposicion","estado","notas","activo","usuario",
  ],
  required: ["nombre"],
  searchFields: ["nombre","descripcion","codigo"],
  filters: ["activo","estado","categoria"],
  orderBy: "nombre",
  ascending: true,
};

export const EQUIPOS_LOG: CrudOptions = {
  table: "rep_equipos_log",
  fields: ["equipo_id","estado_anterior","estado_nuevo","motivo","evento_id","usuario"],
  required: ["equipo_id","estado_nuevo"],
  filters: ["equipo_id","evento_id"],
};

export const EVENTOS: CrudOptions = {
  table: "rep_eventos",
  fields: [
    "cliente_id","tipo_evento","nombre_evento","fecha_evento","hora_inicio","hora_fin",
    "lugar","num_invitados","estado","descuento","deposito","notas","usuario",
  ],
  required: ["nombre_evento","fecha_evento"],
  searchFields: ["nombre_evento","lugar","numero"],
  filters: ["estado","tipo_evento","cliente_id"],
  orderBy: "fecha_evento",
  ascending: true,
};

export const EVENTO_ITEMS: CrudOptions = {
  table: "rep_evento_items",
  fields: [
    "evento_id","tipo","producto_id","equipo_id","descripcion","cantidad",
    "dias_alquiler","precio_unitario","descuento","notas",
  ],
  required: ["evento_id","tipo","descripcion"],
  filters: ["evento_id","tipo"],
  orderBy: "id",
  ascending: true,
};

export const COTIZACIONES: CrudOptions = {
  table: "rep_cotizaciones",
  fields: [
    "evento_id","cliente_id","fecha","fecha_vencimiento","descuento",
    "estado","condiciones","notas","usuario",
  ],
  searchFields: ["numero","notas"],
  filters: ["estado","cliente_id","evento_id"],
};

export const COTIZACION_ITEMS: CrudOptions = {
  table: "rep_cotizacion_items",
  fields: ["cotizacion_id","descripcion","cantidad","precio_unitario","descuento"],
  required: ["cotizacion_id","descripcion"],
  filters: ["cotizacion_id"],
  orderBy: "id",
  ascending: true,
};

export const FACTURAS: CrudOptions = {
  table: "rep_facturas",
  fields: [
    "cotizacion_id","evento_id","cliente_id","fecha_emision","fecha_vencimiento",
    "tipo","ncf_tipo","descuento","estado","notas","usuario",
  ],
  searchFields: ["numero","ncf","notas"],
  filters: ["estado","cliente_id","evento_id","tipo"],
};

export const FACTURA_ITEMS: CrudOptions = {
  table: "rep_factura_items",
  fields: ["factura_id","producto_id","descripcion","cantidad","precio_unitario","descuento"],
  required: ["factura_id","descripcion"],
  filters: ["factura_id"],
  orderBy: "id",
  ascending: true,
};

export const PAGOS: CrudOptions = {
  table: "rep_pagos",
  fields: ["factura_id","evento_id","cliente_id","fecha","monto","metodo","referencia","notas","caja_sesion_id","usuario"],
  required: ["monto"],
  filters: ["factura_id","cliente_id","evento_id","metodo"],
  orderBy: "fecha",
};

export const CUENTAS_PAGAR: CrudOptions = {
  table: "rep_cuentas_pagar",
  fields: [
    "proveedor_id","numero_factura","descripcion","categoria","fecha_emision",
    "fecha_vencimiento","monto_total","estado","notas","usuario",
  ],
  required: ["descripcion","monto_total"],
  searchFields: ["descripcion","numero_factura"],
  filters: ["estado","proveedor_id","categoria"],
};

export const CUENTAS_PAGAR_PAGOS: CrudOptions = {
  table: "rep_cuentas_pagar_pagos",
  fields: ["cuenta_pagar_id","fecha","monto","metodo","referencia","notas","usuario"],
  required: ["cuenta_pagar_id","monto"],
  filters: ["cuenta_pagar_id"],
  orderBy: "fecha",
};

export const CAJA_SESIONES: CrudOptions = {
  table: "rep_caja_sesiones",
  fields: [
    "nombre","monto_apertura","efectivo_declarado","fecha_cierre",
    "estado","notas","abierto_por","cerrado_por",
  ],
  filters: ["estado"],
  orderBy: "fecha_apertura",
};

export const CAJA_MOVIMIENTOS: CrudOptions = {
  table: "rep_caja_movimientos",
  fields: ["sesion_id","tipo","descripcion","monto","metodo","referencia","factura_id","pago_id","venta_id","usuario"],
  required: ["sesion_id","tipo","descripcion","monto"],
  filters: ["sesion_id","tipo","metodo"],
};

export const CAJA_CHICA: CrudOptions = {
  table: "rep_caja_chica",
  fields: ["nombre","fondo_inicial","umbral_reponer","activo","usuario"],
  required: ["nombre"],
  filters: ["activo"],
};

export const CAJA_CHICA_GASTOS: CrudOptions = {
  table: "rep_caja_chica_gastos",
  fields: ["fondo_id","fecha","descripcion","categoria","monto","comprobante_url","aprobado_por","usuario"],
  required: ["fondo_id","descripcion","monto"],
  searchFields: ["descripcion"],
  filters: ["fondo_id","categoria"],
  orderBy: "fecha",
};

export const CAJA_CHICA_REPOSICIONES: CrudOptions = {
  table: "rep_caja_chica_reposiciones",
  fields: ["fondo_id","fecha","monto","descripcion","usuario"],
  required: ["fondo_id","monto"],
  filters: ["fondo_id"],
  orderBy: "fecha",
};

export const MOVIMIENTOS_INVENTARIO: CrudOptions = {
  table: "rep_movimientos_inventario",
  fields: ["tipo","ingrediente_id","equipo_id","cantidad","unidad","costo_unitario","motivo","referencia","evento_id","usuario"],
  required: ["tipo","cantidad"],
  filters: ["tipo","ingrediente_id","equipo_id","evento_id"],
};

export const COMPRAS: CrudOptions = {
  table: "rep_compras_ingredientes",
  fields: [
    "ingrediente_id","proveedor_id","cantidad","unidad","costo_unitario",
    "fecha_compra","fecha_vencimiento","numero_lote","factura_ref","notas","usuario",
  ],
  required: ["ingrediente_id","cantidad"],
  filters: ["ingrediente_id","proveedor_id"],
  orderBy: "fecha_compra",
};

export const VENTAS: CrudOptions = {
  table: "rep_ventas",
  fields: ["anulada","motivo_anulacion","notas","cliente_id","cliente_nombre","cliente_rnc","cajero"],
  searchFields: ["numero","ncf","cliente_nombre"],
  filters: ["anulada","metodo_pago","ncf_tipo","caja_sesion_id"],
};

export const CUADRE: CrudOptions = {
  table: "rep_cuadre",
  fields: [
    "fecha","usuario","ventas_efectivo","ventas_tarjeta","ventas_transferencia",
    "ventas_total","transacciones_count","efectivo_inicial","efectivo_contado",
    "diferencia","notas","cerrado",
  ],
  required: ["fecha"],
  filters: ["cerrado"],
  orderBy: "fecha",
};

export const CONFIG: CrudOptions = {
  table: "rep_config",
  fields: ["clave","valor","descripcion"],
  required: ["clave"],
  orderBy: "clave",
  ascending: true,
};
