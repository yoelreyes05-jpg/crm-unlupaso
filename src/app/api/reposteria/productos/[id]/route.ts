import { recurso } from "@/lib/reposteria/crud";
import { PRODUCTOS } from "@/lib/reposteria/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(PRODUCTOS, "activo");
