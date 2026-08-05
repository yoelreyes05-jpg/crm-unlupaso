import { coleccion } from "@/lib/reposteria/crud";
import { RECETA_INGREDIENTES } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(RECETA_INGREDIENTES);
