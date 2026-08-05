import { coleccion } from "@/lib/reposteria/crud";
import { EQUIPOS_LOG } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(EQUIPOS_LOG);
