import { recurso } from "@/lib/reposteria/crud";
import { CAJA_CHICA } from "@/lib/reposteria/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(CAJA_CHICA, "activo");
