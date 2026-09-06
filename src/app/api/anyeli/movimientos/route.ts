import { coleccion } from "@/lib/anyeli/crud";
import { MOVIMIENTOS } from "@/lib/anyeli/tablas";

export const { GET, POST } = coleccion(MOVIMIENTOS);
