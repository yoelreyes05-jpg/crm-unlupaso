import { coleccion } from "@/lib/reposteria/crud";
import { CUADRE } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(CUADRE);
