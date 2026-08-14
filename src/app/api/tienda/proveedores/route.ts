import { coleccion } from "@/lib/tienda/crud";
import { PROVEEDORES } from "@/lib/tienda/tablas";

export const { GET, POST } = coleccion(PROVEEDORES);
