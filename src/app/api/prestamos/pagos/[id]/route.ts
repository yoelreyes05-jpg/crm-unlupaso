import { recurso } from "@/lib/prestamos/crud";
import { PAGOS } from "@/lib/prestamos/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(PAGOS);
