import { coleccion } from "@/lib/reposteria/crud";
import { PAGOS } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(PAGOS);
