import { coleccion } from "@/lib/reposteria/crud";
import { CUENTAS_PAGAR } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(CUENTAS_PAGAR);
