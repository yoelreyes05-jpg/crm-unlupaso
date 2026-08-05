import { coleccion } from "@/lib/reposteria/crud";
import { MOVIMIENTOS_INVENTARIO } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(MOVIMIENTOS_INVENTARIO);
