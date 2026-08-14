import { recurso } from "@/lib/tienda/crud";
import { PRODUCTOS } from "@/lib/tienda/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(PRODUCTOS, "activo");
