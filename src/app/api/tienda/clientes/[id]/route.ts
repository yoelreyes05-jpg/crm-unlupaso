import { recurso } from "@/lib/tienda/crud";
import { CLIENTES } from "@/lib/tienda/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(CLIENTES, "activo");
