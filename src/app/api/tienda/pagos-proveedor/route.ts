import { coleccion } from "@/lib/tienda/crud";
import { PAGOS_PROVEEDOR } from "@/lib/tienda/tablas";

export const { GET, POST } = coleccion(PAGOS_PROVEEDOR);
