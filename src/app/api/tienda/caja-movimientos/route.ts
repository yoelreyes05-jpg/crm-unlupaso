import { coleccion } from "@/lib/tienda/crud";
import { CAJA_MOVIMIENTOS } from "@/lib/tienda/tablas";

export const { GET, POST } = coleccion(CAJA_MOVIMIENTOS);
