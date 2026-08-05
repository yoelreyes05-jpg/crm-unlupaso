import { recurso } from "@/lib/reposteria/crud";
import { RECETAS } from "@/lib/reposteria/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(RECETAS, "activo");
