import { recurso } from "@/lib/reposteria/crud";
import { CAJA_MOVIMIENTOS } from "@/lib/reposteria/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(CAJA_MOVIMIENTOS);
