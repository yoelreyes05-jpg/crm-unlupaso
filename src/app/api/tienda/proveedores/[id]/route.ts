import { recurso } from "@/lib/tienda/crud";
import { PROVEEDORES } from "@/lib/tienda/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(PROVEEDORES, "activo");
