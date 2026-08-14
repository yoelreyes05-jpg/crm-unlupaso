import { recurso } from "@/lib/tienda/crud";
import { COBROS } from "@/lib/tienda/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(COBROS);
