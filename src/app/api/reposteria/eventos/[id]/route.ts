import { recurso } from "@/lib/reposteria/crud";
import { EVENTOS } from "@/lib/reposteria/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(EVENTOS);
