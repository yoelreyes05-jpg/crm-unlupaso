/**
 * ERP Repostería — tipos TypeScript.
 * Todas las tablas viven en el mismo proyecto Supabase de UNLUPASO
 * con el prefijo `rep_`, sin ninguna relación con las tablas `ul_`.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────
export type RepMetodoPago      = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "CHEQUE" | "DEPOSITO";
export type RepNcfTipo         = "B01" | "B02" | "B14" | "B15";
export type RepEquipoEstado    = "disponible" | "alquilado" | "mantenimiento" | "danado" | "baja";
export type RepEventoEstado    = "cotizado" | "confirmado" | "en_preparacion" | "entregado" | "cerrado" | "cancelado";
export type RepEventoTipo      = "cumpleanos" | "boda" | "baby_shower" | "aniversario" | "corporativo" | "otro";
export type RepCotizacionEstado= "borrador" | "enviada" | "aceptada" | "rechazada" | "vencida";
export type RepFacturaEstado   = "pendiente" | "parcial" | "pagada" | "vencida" | "anulada";
export type RepLoteEstado      = "disponible" | "agotado" | "vencido" | "descartado";
export type RepNivelAlerta     = "ok" | "bajo" | "critico" | "agotado";

export const METODOS_PAGO: RepMetodoPago[] = ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "CHEQUE", "DEPOSITO"];
export const NCF_TIPOS: { key: RepNcfTipo; desc: string }[] = [
  { key: "B02", desc: "Consumidor Final" },
  { key: "B01", desc: "Crédito Fiscal"   },
  { key: "B14", desc: "Régimen Especial" },
  { key: "B15", desc: "Gubernamental"    },
];

export const CATEGORIAS_INGREDIENTE = [
  "harina","lacteo","azucar","grasa","huevo","fruta","saborizante","decoracion","liquido","fruto_seco","otro",
] as const;

export const CATEGORIAS_PRODUCTO = [
  "bizcocho","cupcake","postre","pan","galleta","decoracion","servicio","general",
] as const;

export const CATEGORIAS_EQUIPO = [
  "mesa","silla","carpa","vajilla","mantel","decoracion","audio","iluminacion","cocina","general",
] as const;

export const CATEGORIAS_LOTE = ["bizcocho","galleta","postre","pan","cupcake","otro"] as const;

// ─── Filas ────────────────────────────────────────────────────────────────────
export interface RepConfig {
  id: string; clave: string; valor: string | null;
  descripcion: string | null; updated_at: string;
}

export interface RepCliente {
  id: string; nombre: string; apellido: string;
  email: string | null; telefono: string | null; cedula_rnc: string | null;
  direccion: string | null; tipo: "persona" | "empresa"; notas: string | null;
  activo: boolean; usuario: string | null; created_at: string; updated_at: string;
}

export interface RepProveedor {
  id: string; nombre: string; contacto: string | null; email: string | null;
  telefono: string | null; rnc: string | null; direccion: string | null;
  categoria: string | null; notas: string | null; activo: boolean;
  usuario: string | null; created_at: string; updated_at: string;
}

export interface RepIngrediente {
  id: string; nombre: string; descripcion: string | null; categoria: string;
  unidad: string; costo_unitario: number; stock_actual: number;
  stock_minimo: number; punto_reorden: number; ubicacion: string | null;
  unidad_compra: string | null; costo_compra: number;
  proveedor_id: string | null; fecha_ultimo_movimiento: string | null;
  activo: boolean; usuario: string | null; created_at: string; updated_at: string;
}

export interface RepIngredienteStatus extends RepIngrediente {
  nivel_alerta: RepNivelAlerta;
  valor_stock: number;
  proveedor_nombre: string | null;
  proximo_vencimiento: string | null;
}

export interface RepProducto {
  id: string; nombre: string; descripcion: string | null; categoria: string;
  codigo: string | null; precio_venta: number; costo_estimado: number;
  itbis: number; unidad: string; imagen_url: string | null;
  vende_en_pos: boolean; activo: boolean; usuario: string | null;
  created_at: string; updated_at: string;
}

export interface RepReceta {
  id: string; producto_id: string | null; nombre: string;
  descripcion: string | null; rendimiento: number; unidad_rendimiento: string;
  costo_total: number; costo_por_unidad: number; instrucciones: string | null;
  activo: boolean; usuario: string | null; created_at: string; updated_at: string;
}

export interface RepRecetaIngrediente {
  id: string; receta_id: string; ingrediente_id: string;
  cantidad: number; unidad: string; costo_linea: number; notas: string | null;
}

export interface RepLote {
  id: string; producto_id: string | null; receta_id: string | null;
  nombre_lote: string; categoria: string;
  cantidad_inicial: number; cantidad_actual: number; unidad: string;
  fecha_produccion: string; fecha_vencimiento: string; dias_vida: number;
  costo_unitario: number; precio_venta: number; estado: RepLoteEstado;
  evento_id: string | null; notas: string | null; usuario: string | null;
  created_at: string; updated_at: string;
}

export interface RepLoteAlerta extends RepLote {
  producto_nombre: string | null;
  dias_restantes: number;
  nivel_alerta: "ok" | "proximo" | "critico" | "vencido";
}

export interface RepLoteMovimiento {
  id: string; lote_id: string;
  tipo: "venta" | "descarte" | "merma" | "ajuste" | "reserva" | "produccion";
  cantidad: number; motivo: string | null;
  evento_id: string | null; venta_id: string | null;
  usuario: string | null; created_at: string;
}

export interface RepEquipo {
  id: string; nombre: string; descripcion: string | null; categoria: string;
  codigo: string | null; cantidad_total: number; precio_alquiler: number;
  costo_reposicion: number; estado: RepEquipoEstado; notas: string | null;
  activo: boolean; usuario: string | null; created_at: string; updated_at: string;
}

export interface RepEquipoLog {
  id: string; equipo_id: string;
  estado_anterior: RepEquipoEstado | null; estado_nuevo: RepEquipoEstado;
  motivo: string | null; evento_id: string | null;
  usuario: string | null; created_at: string;
}

export interface RepEvento {
  id: string; numero: string | null; cliente_id: string | null;
  tipo_evento: RepEventoTipo; nombre_evento: string; fecha_evento: string;
  hora_inicio: string | null; hora_fin: string | null; lugar: string | null;
  num_invitados: number | null; estado: RepEventoEstado;
  subtotal: number; descuento: number; itbis: number; total: number;
  deposito: number; balance: number; notas: string | null;
  usuario: string | null; created_at: string; updated_at: string;
}

export interface RepEventoItem {
  id: string; evento_id: string; tipo: "producto" | "equipo" | "servicio";
  producto_id: string | null; equipo_id: string | null; descripcion: string;
  cantidad: number; dias_alquiler: number; precio_unitario: number;
  descuento: number; subtotal: number; notas: string | null;
}

export interface RepCotizacion {
  id: string; numero: string | null; evento_id: string | null;
  cliente_id: string | null; fecha: string; fecha_vencimiento: string | null;
  subtotal: number; descuento: number; itbis: number; total: number;
  estado: RepCotizacionEstado; condiciones: string | null; notas: string | null;
  usuario: string | null; created_at: string; updated_at: string;
}

export interface RepCotizacionItem {
  id: string; cotizacion_id: string; descripcion: string;
  cantidad: number; precio_unitario: number; descuento: number; subtotal: number;
}

export interface RepFactura {
  id: string; numero: string | null; cotizacion_id: string | null;
  evento_id: string | null; cliente_id: string | null;
  fecha_emision: string; fecha_vencimiento: string | null;
  tipo: "contado" | "credito"; ncf: string | null; ncf_tipo: RepNcfTipo;
  subtotal: number; descuento: number; itbis: number; total: number;
  monto_pagado: number; balance: number; estado: RepFacturaEstado;
  notas: string | null; usuario: string | null;
  created_at: string; updated_at: string;
}

export interface RepFacturaItem {
  id: string; factura_id: string; producto_id: string | null;
  descripcion: string; cantidad: number; precio_unitario: number;
  descuento: number; subtotal: number;
}

export interface RepPago {
  id: string; factura_id: string | null; evento_id: string | null;
  cliente_id: string | null; fecha: string; monto: number;
  metodo: RepMetodoPago; referencia: string | null; notas: string | null;
  caja_sesion_id: string | null; usuario: string | null; created_at: string;
}

export interface RepCuentaPagar {
  id: string; proveedor_id: string | null; numero_factura: string | null;
  descripcion: string; categoria: string | null;
  fecha_emision: string; fecha_vencimiento: string | null;
  monto_total: number; monto_pagado: number; balance: number;
  estado: "pendiente" | "parcial" | "pagada" | "vencida" | "anulada";
  notas: string | null; usuario: string | null;
  created_at: string; updated_at: string;
}

export interface RepCuentaPagarPago {
  id: string; cuenta_pagar_id: string; fecha: string; monto: number;
  metodo: RepMetodoPago; referencia: string | null; notas: string | null;
  usuario: string | null; created_at: string;
}

export interface RepCajaSesion {
  id: string; nombre: string; fecha_apertura: string; fecha_cierre: string | null;
  monto_apertura: number; efectivo_esperado: number;
  efectivo_declarado: number | null; diferencia: number;
  estado: "abierta" | "cerrada"; notas: string | null;
  abierto_por: string | null; cerrado_por: string | null; created_at: string;
}

export interface RepCajaMovimiento {
  id: string; sesion_id: string; tipo: "ingreso" | "egreso";
  descripcion: string; monto: number; metodo: RepMetodoPago;
  referencia: string | null; factura_id: string | null;
  pago_id: string | null; venta_id: string | null;
  usuario: string | null; created_at: string;
}

export interface RepCajaChica {
  id: string; nombre: string; fondo_inicial: number; saldo_actual: number;
  umbral_reponer: number; activo: boolean; usuario: string | null;
  created_at: string; updated_at: string;
}

export interface RepCajaChicaGasto {
  id: string; fondo_id: string; fecha: string; descripcion: string;
  categoria: string; monto: number; comprobante_url: string | null;
  aprobado_por: string | null; usuario: string | null; created_at: string;
}

export interface RepCajaChicaReposicion {
  id: string; fondo_id: string; fecha: string; monto: number;
  descripcion: string | null; usuario: string | null; created_at: string;
}

export interface RepMovimientoInventario {
  id: string; tipo: "entrada" | "salida" | "ajuste" | "merma";
  ingrediente_id: string | null; equipo_id: string | null;
  cantidad: number; unidad: string | null; costo_unitario: number | null;
  motivo: string | null; referencia: string | null; evento_id: string | null;
  usuario: string | null; created_at: string;
}

export interface RepCompraIngrediente {
  id: string; ingrediente_id: string; proveedor_id: string | null;
  cantidad: number; unidad: string; costo_unitario: number;
  fecha_compra: string; fecha_vencimiento: string | null;
  numero_lote: string | null; factura_ref: string | null;
  cantidad_restante: number | null; notas: string | null;
  usuario: string | null; created_at: string;
}

export interface RepVenta {
  id: string; numero: string | null; cliente_id: string | null;
  total: number; subtotal: number; itbis_total: number; descuento: number;
  metodo_pago: RepMetodoPago; ncf: string | null; ncf_tipo: RepNcfTipo;
  cliente_nombre: string | null; cliente_rnc: string | null;
  caja_sesion_id: string | null; cajero: string | null; notas: string | null;
  anulada: boolean; motivo_anulacion: string | null; created_at: string;
}

export interface RepDetalleVenta {
  id: string; venta_id: string; producto_id: string | null; lote_id: string | null;
  nombre_producto: string; categoria: string | null; qty: number;
  precio_unitario: number; costo_unitario: number; itbis: number;
  descuento: number; subtotal: number;
}

export interface RepCuadre {
  id: string; fecha: string; usuario: string | null;
  ventas_efectivo: number; ventas_tarjeta: number; ventas_transferencia: number;
  ventas_total: number; transacciones_count: number;
  efectivo_inicial: number; efectivo_contado: number; diferencia: number;
  notas: string | null; cerrado: boolean; created_at: string;
}

// ─── Payload del POS ──────────────────────────────────────────────────────────
export interface RepVentaItemInput {
  producto_id?:     string | null;
  lote_id?:         string | null;
  nombre_producto:  string;
  categoria?:       string | null;
  qty:              number;
  precio_unitario:  number;
  costo_unitario?:  number;
  itbis?:           number;
  descuento?:       number;
  subtotal:         number;
}

export interface RepVentaInput {
  total:           number;
  subtotal?:       number;
  itbis_total?:    number;
  descuento?:      number;
  metodo_pago?:    RepMetodoPago;
  ncf_tipo?:       RepNcfTipo;
  cliente_id?:     string | null;
  cliente_nombre?: string | null;
  cliente_rnc?:    string | null;
  cajero?:         string | null;
  notas?:          string | null;
  items:           RepVentaItemInput[];
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface RepDashboard {
  ventas_hoy:            number;
  ventas_mes:            number;
  transacciones_hoy:     number;
  eventos_proximos:      number;
  eventos_mes:           number;
  por_cobrar:            number;
  por_pagar:             number;
  ingredientes_criticos: number;
  lotes_por_vencer:      number;
  equipos_disponibles:   number;
  cotizaciones_abiertas: number;
  caja_abierta:          boolean;
}
