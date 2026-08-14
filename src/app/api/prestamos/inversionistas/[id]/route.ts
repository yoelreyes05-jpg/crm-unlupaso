import { recurso } from "@/lib/prestamos/crud";
import { INVERSIONISTAS } from "@/lib/prestamos/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(INVERSIONISTAS, "activo");
