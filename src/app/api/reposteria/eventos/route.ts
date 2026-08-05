import { coleccion } from "@/lib/reposteria/crud";
import { EVENTOS } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(EVENTOS);
