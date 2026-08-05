import { coleccion } from "@/lib/reposteria/crud";
import { RECETAS } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(RECETAS);
