import { recurso } from "@/lib/reposteria/crud";
import { RECETA_INGREDIENTES } from "@/lib/reposteria/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(RECETA_INGREDIENTES);
