import { recurso } from "@/lib/tienda/crud";
import { CAJA } from "@/lib/tienda/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(CAJA);
