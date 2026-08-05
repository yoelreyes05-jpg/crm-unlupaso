import { coleccion } from "@/lib/reposteria/crud";
import { VENTAS } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(VENTAS);
