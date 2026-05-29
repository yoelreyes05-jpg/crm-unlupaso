/**
 * Tipos TypeScript de la base de datos UNLUPASO.
 * Generado manualmente - puedes regenerar con:
 *   supabase gen types typescript --linked > src/types/database.ts
 */

export type MetodoPago = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA";
export type NcfTipo    = "B01" | "B02" | "B14" | "B15";

export interface UlProducto {
  id:         number;
  nombre:     string;
  precio:     number;
  categoria:  string;
  stock:      number;
  imagen:     string | null;
  activo:     boolean;
  created_at: string;
  updated_at: string;
}

export interface UlVenta {
  id:          number;
  total:       number;
  metodo_pago: MetodoPago;
  ncf:         string | null;
  ncf_tipo:    NcfTipo;
  created_at:  string;
}

export interface UlDetalleVenta {
  id:              number;
  venta_id:        number;
  producto_id:     number | null;
  nombre_producto: string;
  qty:             number;
  precio_unitario: number;
  subtotal:        number;
}

export interface UlCuadre {
  id:                   number;
  fecha:                string;
  usuario:              string;
  ventas_efectivo:      number;
  ventas_tarjeta:       number;
  ventas_transferencia: number;
  ventas_total:         number;
  transacciones_count:  number;
  efectivo_contado:     number | null;
  diferencia:           number | null;
  notas:                string | null;
  created_at:           string;
}

// Tipo genérico para el cliente Supabase
export type Database = {
  public: {
    Tables: {
      ul_productos:     { Row: UlProducto;     Insert: Omit<UlProducto, "id" | "created_at" | "updated_at">; Update: Partial<UlProducto> };
      ul_ventas:        { Row: UlVenta;         Insert: Omit<UlVenta, "id" | "created_at">;                   Update: Partial<UlVenta> };
      ul_detalle_ventas:{ Row: UlDetalleVenta;  Insert: Omit<UlDetalleVenta, "id">;                           Update: Partial<UlDetalleVenta> };
      ul_cuadre:        { Row: UlCuadre;        Insert: Omit<UlCuadre, "id" | "created_at">;                  Update: Partial<UlCuadre> };
    };
  };
};
