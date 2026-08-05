import { recurso } from "@/lib/reposteria/crud";
import { CLIENTES } from "@/lib/reposteria/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(CLIENTES, "activo");
