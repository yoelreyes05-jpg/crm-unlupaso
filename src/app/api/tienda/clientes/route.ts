import { NextRequest } from "next/server";
import { coleccion, listar } from "@/lib/tienda/crud";
import { CLIENTES, CLIENTES_VISTA } from "@/lib/tienda/tablas";

/** GET lee de la vista (trae los totales calculados); POST escribe en la tabla. */
export const GET = (req: NextRequest) => listar(req, CLIENTES_VISTA);
export const { POST } = coleccion(CLIENTES);
