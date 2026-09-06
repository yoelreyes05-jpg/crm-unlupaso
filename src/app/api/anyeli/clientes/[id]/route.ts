import { recurso } from "@/lib/anyeli/crud";
import { CLIENTES } from "@/lib/anyeli/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(CLIENTES, "activo");
