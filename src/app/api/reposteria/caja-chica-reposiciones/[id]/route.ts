import { recurso } from "@/lib/reposteria/crud";
import { CAJA_CHICA_REPOSICIONES } from "@/lib/reposteria/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(CAJA_CHICA_REPOSICIONES);
