import { recurso } from "@/lib/reposteria/crud";
import { VENTAS } from "@/lib/reposteria/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(VENTAS);
