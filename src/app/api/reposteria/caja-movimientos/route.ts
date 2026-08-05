import { coleccion } from "@/lib/reposteria/crud";
import { CAJA_MOVIMIENTOS } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(CAJA_MOVIMIENTOS);
