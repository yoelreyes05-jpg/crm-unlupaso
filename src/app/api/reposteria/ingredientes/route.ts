import { coleccion } from "@/lib/reposteria/crud";
import { INGREDIENTES } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(INGREDIENTES);
