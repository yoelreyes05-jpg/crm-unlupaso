import { recurso } from "@/lib/reposteria/crud";
import { COTIZACIONES } from "@/lib/reposteria/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(COTIZACIONES);
