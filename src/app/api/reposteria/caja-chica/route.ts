import { coleccion } from "@/lib/reposteria/crud";
import { CAJA_CHICA } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(CAJA_CHICA);
