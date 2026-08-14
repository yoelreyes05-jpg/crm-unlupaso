import { recurso } from "@/lib/prestamos/crud";
import { CUOTAS } from "@/lib/prestamos/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(CUOTAS);
