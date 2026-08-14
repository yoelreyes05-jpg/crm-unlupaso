import { recurso } from "@/lib/tienda/crud";
import { CAJA_MOVIMIENTOS } from "@/lib/tienda/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(CAJA_MOVIMIENTOS);
