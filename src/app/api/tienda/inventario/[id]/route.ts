import { recurso } from "@/lib/tienda/crud";
import { INVENTARIO } from "@/lib/tienda/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(INVENTARIO);
