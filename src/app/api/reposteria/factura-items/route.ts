import { coleccion } from "@/lib/reposteria/crud";
import { FACTURA_ITEMS } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(FACTURA_ITEMS);
