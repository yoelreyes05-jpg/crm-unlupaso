import { coleccion } from "@/lib/reposteria/crud";
import { PRODUCTOS } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(PRODUCTOS);
