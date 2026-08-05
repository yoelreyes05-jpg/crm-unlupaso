import { coleccion } from "@/lib/reposteria/crud";
import { EQUIPOS } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(EQUIPOS);
