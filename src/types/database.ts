/**
 * Tipos TypeScript de la base de datos UNLUPASO.
 * Para regenerar automáticamente:
 *   npx supabase gen types typescript --linked > src/types/database.ts
 */

export type MetodoPago = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA";
export type NcfTipo    = "B01" | "B02" | "B14" | "B15";
export type Categoria  = "HELADOS" | "CHURROS" | "BIZCOCHOS" | "CAFE" | "BEBIDAS" | "POSTRES" | "SNACKS" | "OTROS";

// ─── Row types ────────────────────────────────────────────────────────────────

export interface UlProducto {
  id:           string;
  nombre:       string;
  descripcion:  string | null;
  precio:       number;
  costo:        number;
  categoria:    Categoria;
  stock:        number;
  stock_minimo: number;
  imagen:       string | null;
  activo:       boolean;
  codigo:       string | null;
  itbis:        number;
  created_at:   string;
  updated_at:   string;
}

export interface UlVenta {
  id:               string;
  numero:           string | null;
  total:            number;
  subtotal:         number;
  itbis_total:      number;
  descuento:        number;
  metodo_pago:      MetodoPago;
  ncf:              string | null;
  ncf_tipo:         NcfTipo;
  cliente_nombre:   string | null;
  cliente_rnc:      string | null;
  notas:            string | null;
  cajero:           string | null;
  anulada:          boolean;
  motivo_anulacion: string | null;
  created_at:       string;
}

export interface UlDetalleVenta {
  id:              string;
  venta_id:        string;
  producto_id:     string | null;
  nombre_producto: string;
  categoria:       string | null;
  qty:             number;
  precio_unitario: number;
  costo_unitario:  number;
  itbis:           number;
  descuento:       number;
  subtotal:        number;
}

export interface UlCuadre {
  id:                   string;
  fecha:                string;
  usuario:              string | null;
  ventas_efectivo:      number;
  ventas_tarjeta:       number;
  ventas_transferencia: number;
  ventas_total:         number;
  transacciones_count:  number;
  efectivo_inicial:     number;
  efectivo_contado:     number;
  diferencia:           number;
  notas:                string | null;
  cerrado:              boolean;
  created_at:           string;
}

export interface UlConfig {
  id:          string;
  clave:       string;
  valor:       string | null;
  descripcion: string | null;
  updated_at:  string;
}

export interface UlSecuenciaNcf {
  tipo:      NcfTipo;
  prefijo:   string;
  siguiente: number;
  maximo:    number;
  activo:    boolean;
}

export interface UlMovimientoInventario {
  id:            string;
  producto_id:   string;
  tipo:          string;
  cantidad:      number;
  stock_antes:   number | null;
  stock_despues: number | null;
  referencia_id: string | null;
  notas:         string | null;
  usuario:       string | null;
  created_at:    string;
}

// ─── Database type (requerido por createClient<Database>) ────────────────────

export type Database = {
  public: {
    Tables: {
      ul_productos: {
        Row:    UlProducto;
        Insert: Omit<UlProducto, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<UlProducto, "id" | "created_at" | "updated_at">>;
      };
      ul_ventas: {
        Row:    UlVenta;
        Insert: Omit<UlVenta, "id" | "numero" | "created_at">;
        Update: Partial<Omit<UlVenta, "id" | "created_at">>;
      };
      ul_detalle_ventas: {
        Row:    UlDetalleVenta;
        Insert: Omit<UlDetalleVenta, "id">;
        Update: Partial<Omit<UlDetalleVenta, "id">>;
      };
      ul_cuadre: {
        Row:    UlCuadre;
        Insert: Omit<UlCuadre, "id" | "created_at">;
        Update: Partial<Omit<UlCuadre, "id" | "created_at">>;
      };
      ul_config: {
        Row:    UlConfig;
        Insert: Omit<UlConfig, "id">;
        Update: Partial<Omit<UlConfig, "id">>;
      };
      ul_secuencias_ncf: {
        Row:    UlSecuenciaNcf;
        Insert: UlSecuenciaNcf;
        Update: Partial<UlSecuenciaNcf>;
      };
      ul_movimientos_inventario: {
        Row:    UlMovimientoInventario;
        Insert: Omit<UlMovimientoInventario, "id" | "created_at">;
        Update: Partial<Omit<UlMovimientoInventario, "id" | "created_at">>;
      };
    };
    Views:          Record<string, { Row: Record<string, unknown> }>;
    Functions:      Record<string, unknown>;
    Enums:          Record<string, unknown>;
    CompositeTypes: Record<string, unknown>;
  };
};
