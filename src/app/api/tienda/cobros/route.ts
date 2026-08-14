import { coleccion } from "@/lib/tienda/crud";
import { COBROS } from "@/lib/tienda/tablas";

export const { GET, POST } = coleccion(COBROS);
