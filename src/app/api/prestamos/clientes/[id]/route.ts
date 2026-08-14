import { recurso } from "@/lib/prestamos/crud";
import { CLIENTES } from "@/lib/prestamos/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(CLIENTES, "activo");
