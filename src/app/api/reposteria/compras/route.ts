import { coleccion } from "@/lib/reposteria/crud";
import { COMPRAS } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(COMPRAS);
