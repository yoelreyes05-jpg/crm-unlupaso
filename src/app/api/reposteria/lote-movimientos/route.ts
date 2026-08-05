import { coleccion } from "@/lib/reposteria/crud";
import { LOTE_MOVIMIENTOS } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(LOTE_MOVIMIENTOS);
