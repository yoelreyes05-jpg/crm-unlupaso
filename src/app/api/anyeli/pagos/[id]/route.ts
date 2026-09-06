import { recurso } from "@/lib/anyeli/crud";
import { PAGOS } from "@/lib/anyeli/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(PAGOS);
