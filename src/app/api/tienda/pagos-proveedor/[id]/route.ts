import { recurso } from "@/lib/tienda/crud";
import { PAGOS_PROVEEDOR } from "@/lib/tienda/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(PAGOS_PROVEEDOR);
