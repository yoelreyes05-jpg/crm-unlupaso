import { recurso } from "@/lib/prestamos/crud";
import { MOVIMIENTOS } from "@/lib/prestamos/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(MOVIMIENTOS);
