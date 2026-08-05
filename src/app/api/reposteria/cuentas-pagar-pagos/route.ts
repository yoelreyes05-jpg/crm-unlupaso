import { coleccion } from "@/lib/reposteria/crud";
import { CUENTAS_PAGAR_PAGOS } from "@/lib/reposteria/tablas";

export const { GET, POST } = coleccion(CUENTAS_PAGAR_PAGOS);
