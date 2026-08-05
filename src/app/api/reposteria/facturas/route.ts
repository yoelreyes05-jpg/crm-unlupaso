import { coleccion } from "@/lib/reposteria/crud";
import { FACTURAS } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(FACTURAS);
