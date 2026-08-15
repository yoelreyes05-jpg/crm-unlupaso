import { recurso } from "@/lib/tienda/crud";
import { CATEGORIAS } from "@/lib/tienda/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(CATEGORIAS, "activo");
