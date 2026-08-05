import { coleccion } from "@/lib/reposteria/crud";
import { COTIZACIONES } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(COTIZACIONES);
