import { NextRequest } from "next/server";
import { listar } from "@/lib/anyeli/crud";
import { CUOTAS_VISTA } from "@/lib/anyeli/tablas";

/** Cronograma de cuotas con días de atraso y estado visual ya calculados. */
export const GET = (req: NextRequest) => listar(req, CUOTAS_VISTA);
