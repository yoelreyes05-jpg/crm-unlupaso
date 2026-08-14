import { NextRequest } from "next/server";
import { listar } from "@/lib/prestamos/crud";
import { CUOTAS_VISTA } from "@/lib/prestamos/tablas";

/** Cronograma de cuotas con días de atraso y estado visual ya calculados. */
export const GET = (req: NextRequest) => listar(req, CUOTAS_VISTA);
