import { coleccion } from "@/lib/reposteria/crud";
import { CLIENTES } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(CLIENTES);
