import { recurso } from "@/lib/reposteria/crud";
import { PROVEEDORES } from "@/lib/reposteria/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(PROVEEDORES, "activo");
