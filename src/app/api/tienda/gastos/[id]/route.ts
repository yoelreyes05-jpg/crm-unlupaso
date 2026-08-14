import { recurso } from "@/lib/tienda/crud";
import { GASTOS } from "@/lib/tienda/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(GASTOS);
