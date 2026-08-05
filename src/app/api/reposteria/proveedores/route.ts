import { coleccion } from "@/lib/reposteria/crud";
import { PROVEEDORES } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(PROVEEDORES);
