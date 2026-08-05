import { recurso } from "@/lib/reposteria/crud";
import { LOTE_MOVIMIENTOS } from "@/lib/reposteria/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(LOTE_MOVIMIENTOS);
