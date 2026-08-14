import { coleccion } from "@/lib/tienda/crud";
import { GASTOS } from "@/lib/tienda/tablas";

export const { GET, POST } = coleccion(GASTOS);
