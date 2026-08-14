import { coleccion } from "@/lib/prestamos/crud";
import { MOVIMIENTOS } from "@/lib/prestamos/tablas";

export const { GET, POST } = coleccion(MOVIMIENTOS);
