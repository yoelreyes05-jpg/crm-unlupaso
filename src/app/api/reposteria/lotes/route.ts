import { coleccion } from "@/lib/reposteria/crud";
import { LOTES } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(LOTES);
