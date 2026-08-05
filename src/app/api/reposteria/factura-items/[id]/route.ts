import { recurso } from "@/lib/reposteria/crud";
import { FACTURA_ITEMS } from "@/lib/reposteria/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(FACTURA_ITEMS);
