import { coleccion } from "@/lib/reposteria/crud";
import { COTIZACION_ITEMS } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(COTIZACION_ITEMS);
