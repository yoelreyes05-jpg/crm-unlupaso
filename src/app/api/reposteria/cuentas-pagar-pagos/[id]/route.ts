import { recurso } from "@/lib/reposteria/crud";
import { CUENTAS_PAGAR_PAGOS } from "@/lib/reposteria/tablas";

export const { GET, PATCH, PUT, DELETE } = recurso(CUENTAS_PAGAR_PAGOS);
