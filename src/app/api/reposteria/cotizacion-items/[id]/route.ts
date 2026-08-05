import { recurso } from "@/lib/reposteria/crud";
import { COTIZACION_ITEMS } from "@/lib/reposteria/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(COTIZACION_ITEMS);
