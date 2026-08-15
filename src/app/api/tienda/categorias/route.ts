import { coleccion } from "@/lib/tienda/crud";
import { CATEGORIAS } from "@/lib/tienda/tablas";

export const { GET, POST } = coleccion(CATEGORIAS);
