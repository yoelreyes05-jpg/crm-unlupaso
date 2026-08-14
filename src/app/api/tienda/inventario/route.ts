import { coleccion } from "@/lib/tienda/crud";
import { INVENTARIO } from "@/lib/tienda/tablas";

export const { GET, POST } = coleccion(INVENTARIO);
