import { recurso } from "@/lib/anyeli/crud";
import { MOVIMIENTOS } from "@/lib/anyeli/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(MOVIMIENTOS);
