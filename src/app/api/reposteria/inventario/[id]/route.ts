import { recurso } from "@/lib/reposteria/crud";
import { MOVIMIENTOS_INVENTARIO } from "@/lib/reposteria/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(MOVIMIENTOS_INVENTARIO);
