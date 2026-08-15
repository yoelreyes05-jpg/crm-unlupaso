import { recurso } from "@/lib/tienda/crud";
import { PRODUCTOS } from "@/lib/tienda/tablas";

/** Una paca es un producto con tipo_inventario = 'lote'. */
export const { GET, PATCH, PUT, DELETE } = recurso(PRODUCTOS, "activo");
