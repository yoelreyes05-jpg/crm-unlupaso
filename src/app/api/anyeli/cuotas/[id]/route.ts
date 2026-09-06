import { recurso } from "@/lib/anyeli/crud";
import { CUOTAS } from "@/lib/anyeli/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(CUOTAS);
