import { recurso } from "@/lib/reposteria/crud";
import { EQUIPOS_LOG } from "@/lib/reposteria/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(EQUIPOS_LOG);
